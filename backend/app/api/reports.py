from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.schemas import Asset, Spec
from fpdf import FPDF
import pandas as pd
import io
import matplotlib
import matplotlib.pyplot as plt
import base64
from datetime import datetime

# Use non-GUI backend for matplotlib to avoid issues on servers
matplotlib.use('Agg')

router = APIRouter(prefix="/reports", tags=["Reports"])

def generate_chart_image(data_dict, title, xlabel, ylabel, chart_type='bar', color='skyblue'):
    """Helper to generate a chart and return it as a BytesIO object."""
    fig, ax = plt.subplots(figsize=(6, 4))
    
    labels = list(data_dict.keys())
    values = list(data_dict.values())
    
    if chart_type == 'bar':
        bars = ax.bar(labels, values, color=color)
        # Add labels on top
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.text(bar.get_x() + bar.get_width()/2., height,
                        '%.1f' % height if isinstance(height, float) else '%d' % int(height),
                        ha='center', va='bottom', fontsize=8)
    
    ax.set_title(title, fontsize=10, fontweight='bold')
    ax.set_xlabel(xlabel, fontsize=9)
    ax.set_ylabel(ylabel, fontsize=9)
    plt.xticks(rotation=15, ha='right', fontsize=8)
    plt.yticks(fontsize=8)
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    plt.close(fig)
    return buf

class MonthlyReportPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 16)
        self.cell(0, 10, 'OptiAsset Monthly Health Report', 0, 1, 'C')
        self.set_font('Arial', 'I', 10)
        self.cell(0, 5, f'Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M")}', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

@router.get("/monthly-summary", response_class=StreamingResponse)
def get_monthly_summary(db: Session = Depends(get_db)):
    """
    Generates a PDF report with charts and statistics.
    """
    
    # --- 1. Fetch Data ---
    
    # Health Counts
    health_counts = db.query(Asset.health_score, func.count(Asset.id)).filter(Asset.is_active == True).group_by(Asset.health_score).all()
    health_map = {h[0]: h[1] for h in health_counts}
    
    # Age Data
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    age_data = {}
    for asset in assets:
        dtype = asset.device_type
        if not dtype and asset.model_name:
             try:
                 if asset.spec: dtype = asset.spec.device_type
             except: pass
             if not dtype:
                 spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
                 if spec: dtype = spec.device_type
        
        if dtype:
            if dtype not in age_data: age_data[dtype] = []
            age_data[dtype].append(asset.initial_age)
    
    avg_age_map = {k: sum(v)/len(v) for k, v in age_data.items() if v}

    # Maintenance Stats
    total_repairs = db.query(func.sum(Asset.repairs)).filter(Asset.is_active == True).scalar() or 0
    total_assets = len(assets)
    
    # --- 2. Generate Charts ---
    
    # Health Chart
    statuses = ["Healthy", "Warning", "Critical", "Unscored"]
    health_plot_data = {s: health_map.get(s, 0) for s in statuses}
    health_chart_img = generate_chart_image(health_plot_data, "Fleet Health Distribution", "Health Status", "Count", color=['green', 'orange', 'red', 'gray'])
    
    # Age Chart
    age_chart_img = generate_chart_image(avg_age_map, "Average Age by Device Type", "Device Type", "Age (Months)", color='skyblue')

    # --- 3. Build PDF ---
    pdf = MonthlyReportPDF()
    pdf.add_page()
    
    # Summary Section
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'Executive Summary', 0, 1)
    pdf.set_font('Arial', '', 10)
    pdf.cell(0, 6, f'Total Active Assets: {total_assets}', 0, 1)
    pdf.cell(0, 6, f'Total Recorded Repairs: {total_repairs}', 0, 1)
    
    critical_count = health_map.get("Critical", 0)
    warning_count = health_map.get("Warning", 0)
    pdf.set_text_color(200, 0, 0) if critical_count > 0 else pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, f'Assets Requiring Immediate Action (Critical): {critical_count}', 0, 1)
    pdf.set_text_color(255, 140, 0) if warning_count > 0 else pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, f'Assets to Monitor (Warning): {warning_count}', 0, 1)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # Health Chart
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'Health Analysis', 0, 1)
    # Save chart temporarily to disk or use a workaround for FPDF to read from memory?
    # FPDF2 supports BytesIO directly if we use the 'image' method correctly or save to a temp file.
    # Safe bet: Write to a temp name (or use specialized buffer handling if available)
    # FPDF's image() accepts a file path or a PIL image. BytesIO is tricky in older versions.
    # Let's save to a temporary file path for reliability.
    
    import tempfile
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_health:
        tmp_health.write(health_chart_img.getvalue())
        tmp_health_path = tmp_health.name
        
    pdf.image(tmp_health_path, x=15, w=180)
    pdf.ln(5)
    
    # Age Chart
    pdf.add_page() # New page for Age chart
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'Aging Analysis', 0, 1)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_age:
        tmp_age.write(age_chart_img.getvalue())
        tmp_age_path = tmp_age.name
        
    pdf.image(tmp_age_path, x=15, w=180)
    
    # Clean up temp files
    try:
        os.remove(tmp_health_path)
        os.remove(tmp_age_path)
    except:
        pass

    # Output PDF to bytes
    pdf_output = io.BytesIO()
    # FPDF output() returns a string in Py2, bytes in Py3. 
    # Or we can write to a file. 
    # FPDF2 allows outputting to a bytearray.
    pdf_bytes = pdf.output(dest='S') # 'S' returns the document as a byte string
    
    # Depending on FPDF version, output might return string (latin-1) or bytes.
    # Ideally 'dest=S' returns bytes in fpdf2.
    if isinstance(pdf_bytes, str):
        pdf_bytes = pdf_bytes.encode('latin-1')
    
    pdf_stream = io.BytesIO(pdf_bytes)

    response = StreamingResponse(pdf_stream, media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename=Monthly_Report_{datetime.now().strftime('%Y_%m')}.pdf"
    return response

@router.get("/charts/health-distribution")
def get_health_distribution_data(db: Session = Depends(get_db)):
    """
    Returns JSON data for the health distribution chart.
    """
    health_counts = db.query(
        Asset.health_score, func.count(Asset.id)
    ).filter(Asset.is_active == True).group_by(Asset.health_score).all()
    
    data_map = {h[0]: h[1] for h in health_counts}
    
    statuses = ["Healthy", "Warning", "Critical", "Unscored"]
    
    data = []
    for s in statuses:
        data.append({"name": s, "value": data_map.get(s, 0)})
        
    return data

@router.get("/charts/age-distribution")
def get_age_distribution_data(db: Session = Depends(get_db)):
    """
    Returns JSON data for average age per device type.
    """
    # 1. Fetch assets with their device types
    assets = db.query(Asset).filter(Asset.is_active == True).all()

    # 2. Process to fill missing device_type using Specs if needed
    data_points = {} # {device_type: [ages]}
    
    for asset in assets:
        dtype = asset.device_type
        # Fallback to Spec if direct device_type is missing
        if not dtype and asset.model_name:
             # Manual lookup if not populated
             try:
                 if asset.spec:
                     dtype = asset.spec.device_type
             except:
                 pass
                 
             if not dtype:
                 spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
                 if spec:
                     dtype = spec.device_type
        
        if dtype:
            if dtype not in data_points:
                data_points[dtype] = []
            data_points[dtype].append(asset.initial_age)

    # 3. Calculate Averages and format for JSON
    data = []
    if data_points:
        for dtype, ages in data_points.items():
            if ages:
                avg = sum(ages) / len(ages)
                data.append({"name": dtype, "value": round(avg, 1)})
    
    return data