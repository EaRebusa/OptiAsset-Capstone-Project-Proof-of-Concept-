from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.schemas import Asset, Spec
from app.core.engine import engine # Import engine for age calc
from fpdf import FPDF
import pandas as pd
import io
import matplotlib
import matplotlib.pyplot as plt
import base64
from datetime import datetime
import tempfile
import os

# Use non-GUI backend for matplotlib to avoid issues on servers
matplotlib.use('Agg')

router = APIRouter(prefix="/reports", tags=["Reports"])

def generate_chart_image(data_dict, title, xlabel, ylabel, chart_type='bar', color='skyblue'):
    """Helper to generate a chart and return it as a BytesIO object."""
    fig, ax = plt.subplots(figsize=(6, 4))
    
    labels = list(data_dict.keys())
    values = list(data_dict.values())
    
    # Check for empty or zero data to prevent crashes (especially for pie charts)
    if not values or sum([v for v in values if isinstance(v, (int, float))]) == 0:
        ax.text(0.5, 0.5, "No Data Available", ha='center', va='center', fontsize=12, color='gray')
        ax.set_title(title, fontsize=10, fontweight='bold')
        ax.axis('off') # Hide axes for cleaner empty state
    else:
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
            
        elif chart_type == 'pie':
            # Pie chart specific safe drawing
            ax.pie(values, labels=labels, autopct='%1.1f%%', startangle=90, colors=color)
            ax.axis('equal') 
            ax.set_title(title, fontsize=10, fontweight='bold')
    
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
    Generates a PDF report with charts, statistics, and top critical assets.
    """
    
    # --- 1. Fetch & Process Data ---
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    specs = db.query(Spec).all()
    spec_map = {s.model_name: s for s in specs}
    
    # Init metrics
    health_counts = {"Healthy": 0, "Warning": 0, "Critical": 0, "Unscored": 0}
    age_data = {}
    financial_risk = {"Replacement": 0, "Maintenance": 0}
    critical_assets_list = []

    total_repairs = 0

    for asset in assets:
        # Health
        score = asset.override_score if asset.override_score else asset.health_score
        health_counts[score] = health_counts.get(score, 0) + 1
        
        # Repairs
        total_repairs += asset.repairs

        # Age Calculation
        current_age = engine.calculate_current_age(asset.initial_age, asset.created_at)

        # Device Type Resolution
        dtype = asset.device_type
        if not dtype and asset.model_name in spec_map:
            dtype = spec_map[asset.model_name].device_type
        
        if dtype:
            if dtype not in age_data: age_data[dtype] = []
            age_data[dtype].append(current_age)

        # Financials
        cost = 0
        if asset.model_name in spec_map:
            cost = spec_map[asset.model_name].replacement_cost
        elif dtype == 'laptop': cost = 30000
        elif dtype == 'desktop': cost = 25000
        
        if score == "Critical":
            financial_risk["Replacement"] += cost
            critical_assets_list.append({
                "id": asset.asset_id,
                "model": asset.model_name,
                "age": current_age,
                "risk": cost
            })
        elif score == "Warning":
            financial_risk["Maintenance"] += (cost * 0.10)

    avg_age_map = {k: sum(v)/len(v) for k, v in age_data.items() if v}
    
    # Sort critical assets by risk (highest first)
    critical_assets_list.sort(key=lambda x: x['risk'], reverse=True)
    top_10_critical = critical_assets_list[:10]

    # --- 2. Generate Charts ---
    
    # Health Chart
    health_chart_img = generate_chart_image(
        health_counts, "Fleet Health Distribution", "Health Status", "Count", 
        color=['green', 'orange', 'red', 'gray']
    )
    
    # Age Chart
    age_chart_img = generate_chart_image(
        avg_age_map, "Average Age by Device Type", "Device Type", "Age (Months)", 
        color='skyblue'
    )

    # Financial Pie Chart
    # Handle zero risk gracefully
    if sum(financial_risk.values()) == 0:
        fin_chart_img = generate_chart_image(
            financial_risk, "Financial Risk Breakdown (No Risk Detected)", "", "", 
            chart_type='pie', color=['#cbd5e1', '#cbd5e1'] # Gray
        )
    else:
        fin_chart_img = generate_chart_image(
            financial_risk, "Financial Risk Breakdown (PHP)", "", "", 
            chart_type='pie', color=['#ef4444', '#f59e0b'] # Red, Amber
        )

    # --- 3. Build PDF ---
    pdf = MonthlyReportPDF()
    pdf.add_page()
    
    # Executive Summary
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, '1. Executive Summary', 0, 1)
    pdf.set_font('Arial', '', 10)
    pdf.cell(0, 6, f'Total Active Assets: {len(assets)}', 0, 1)
    pdf.cell(0, 6, f'Total Recorded Repairs: {total_repairs}', 0, 1)
    
    total_risk = financial_risk["Replacement"] + financial_risk["Maintenance"]
    pdf.cell(0, 6, f'Total Forecasted Financial Risk: PHP {total_risk:,.2f}', 0, 1)
    pdf.ln(5)

    # Health Analysis
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, '2. Health & Risk Analysis', 0, 1)
    
    # Embed Health Chart
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_health:
        tmp_health.write(health_chart_img.getvalue())
        tmp_health_path = tmp_health.name
    pdf.image(tmp_health_path, x=15, w=170)
    pdf.ln(5)

    # Financial Analysis text
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(0, 8, 'Financial Risk Distribution:', 0, 1)
    pdf.set_font('Arial', '', 9)
    if total_risk == 0:
        pdf.cell(0, 5, "No financial risk detected. Fleet is currently healthy.", 0, 1)
    else:
        pdf.cell(0, 5, f"- Replacement Budget (Critical): PHP {financial_risk['Replacement']:,.2f}", 0, 1)
        pdf.cell(0, 5, f"- Maintenance Budget (Warning): PHP {financial_risk['Maintenance']:,.2f}", 0, 1)
    
    # Embed Financial Pie Chart
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_fin:
        tmp_fin.write(fin_chart_img.getvalue())
        tmp_fin_path = tmp_fin.name
    pdf.image(tmp_fin_path, x=50, w=100) # Centered smaller pie chart
    
    pdf.add_page()

    # Aging Analysis
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, '3. Aging Analysis', 0, 1)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_age:
        tmp_age.write(age_chart_img.getvalue())
        tmp_age_path = tmp_age.name
    pdf.image(tmp_age_path, x=15, w=170)
    pdf.ln(10)

    # Top 10 Critical Assets Table
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, '4. Action Required: Top 10 Critical Assets', 0, 1)
    
    # Table Header
    pdf.set_font('Arial', 'B', 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(40, 8, 'Asset ID', 1, 0, 'C', 1)
    pdf.cell(80, 8, 'Model', 1, 0, 'C', 1)
    pdf.cell(25, 8, 'Age (Mos)', 1, 0, 'C', 1)
    pdf.cell(45, 8, 'Est. Cost (PHP)', 1, 1, 'C', 1)
    
    # Table Rows
    pdf.set_font('Arial', '', 9)
    if top_10_critical:
        for item in top_10_critical:
            pdf.cell(40, 8, str(item['id']), 1, 0, 'C')
            pdf.cell(80, 8, str(item['model'])[:35], 1, 0, 'L') # Truncate long names
            pdf.cell(25, 8, str(item['age']), 1, 0, 'C')
            pdf.cell(45, 8, f"{item['risk']:,.0f}", 1, 1, 'R')
    else:
        pdf.cell(190, 8, "No critical assets found.", 1, 1, 'C')

    # Cleanup
    for p in [tmp_health_path, tmp_age_path, tmp_fin_path]:
        try: os.remove(p)
        except: pass

    # Output
    pdf_bytes = pdf.output(dest='S')
    if isinstance(pdf_bytes, str): pdf_bytes = pdf_bytes.encode('latin-1')
    
    response = StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename=OptiAsset_Monthly_Report_{datetime.now().strftime('%Y_%m')}.pdf"
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
            # Calculate actual current age here too for accuracy
            age = engine.calculate_current_age(asset.initial_age, asset.created_at)
            data_points[dtype].append(age)

    # 3. Calculate Averages and format for JSON
    data = []
    if data_points:
        for dtype, ages in data_points.items():
            if ages:
                avg = sum(ages) / len(ages)
                data.append({"name": dtype, "value": round(avg, 1)})
    
    return data