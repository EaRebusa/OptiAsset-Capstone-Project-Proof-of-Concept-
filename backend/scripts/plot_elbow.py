import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from pathlib import Path

def generate_elbow_plot():
    print("📊 Loading data for Elbow Method analysis...")
    
    # Resolve paths reliably based on the script's location
    backend_root = Path(__file__).resolve().parent.parent
    data_path = backend_root / "data" / "optiasset_inventory_1200.csv"
    
    if not data_path.exists():
        print(f"❌ [ERROR] CSV not found at {data_path}")
        return

    # 1. Load Data
    df = pd.read_csv(data_path)

    # 2. Feature Engineering & Standardization (Mirroring verify_data.py)
    NORMAL_TEMP = 40.0
    NORMAL_USAGE = 30.0
    df['age_vs_warranty'] = df['initial_age']
    df['temp_vs_norm'] = df['current_temp'] / NORMAL_TEMP
    df['usage_vs_norm'] = df['current_usage'] / NORMAL_USAGE
    df['maintenance_score'] = df['maint_score']

    features = ['age_vs_warranty', 'temp_vs_norm', 'usage_vs_norm', 'maintenance_score', 'repairs']
    X = df[features]

    # 3. Preprocessing
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 4. Calculate SSE for k=1 through k=10
    sse = []
    k_range = range(1, 11)
    print("🔄 Running KMeans for k=1 to 10. Please wait...")
    
    for k in k_range:
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
        kmeans.fit(X_scaled)
        sse.append(kmeans.inertia_)

    # 5. Plot the Results
    plt.figure(figsize=(9, 6))
    plt.plot(k_range, sse, marker='o', linestyle='-', color='#2c3e50', linewidth=2, markersize=8)
    plt.title('Elbow Method for Optimal k', fontsize=14, fontweight='bold')
    plt.xlabel('Number of Clusters (k)', fontsize=12)
    plt.ylabel('Inertia (Sum of Squared Distances)', fontsize=12)
    plt.xticks(k_range)
    plt.grid(True, linestyle='--', alpha=0.7)
    
    # Highlight our chosen business logic (k=3)
    plt.axvline(x=3, color='#e74c3c', linestyle='--', linewidth=2, label='Chosen k=3 (Business Target)')
    plt.legend(fontsize=11)
    
    # Display the plot
    print("✨ Rendering plot! Close the plot window to exit the script.")
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    generate_elbow_plot()