import os
import requests
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
import sys

def plot_clusters(X: np.ndarray, y: np.ndarray, save_path: str, cluster_names: dict = None):
    """
    Reduces high-dimensional data using PCA and generates 2D/3D scatter plots.
    """
    # Apply PCA to reduce dimensions
    pca_2d = PCA(n_components=2)
    X_2d = pca_2d.fit_transform(X)

    pca_3d = PCA(n_components=3)
    X_3d = pca_3d.fit_transform(X)

    # Create figure for side-by-side plots
    fig = plt.figure(figsize=(18, 8))
    fig.suptitle('Cluster Profiles: PCA Reduced Scatter Plots', fontsize=16)

    # --- 2D Plot ---
    ax1 = fig.add_subplot(1, 2, 1)
    scatter1 = ax1.scatter(X_2d[:, 0], X_2d[:, 1], c=y, cmap='viridis', alpha=0.8, edgecolors='k', s=50)
    ax1.set_title('2D Cluster Scatter Plot')
    ax1.set_xlabel('Principal Component 1')
    ax1.set_ylabel('Principal Component 2')
    ax1.grid(True, linestyle='--', alpha=0.6)

    # --- 3D Plot ---
    ax2 = fig.add_subplot(1, 2, 2, projection='3d')
    scatter2 = ax2.scatter(X_3d[:, 0], X_3d[:, 1], X_3d[:, 2], c=y, cmap='viridis', alpha=0.8, edgecolors='k', s=50)
    ax2.set_title('3D Cluster Scatter Plot')
    ax2.set_xlabel('Principal Component 1')
    ax2.set_ylabel('Principal Component 2')
    ax2.set_zlabel('Principal Component 3')

    # --- Create Legends (after both plots are created) ---
    if cluster_names:
        # Create custom legend handles for a more descriptive legend
        handles = [plt.Line2D([0], [0], marker='o', color='w', label=cluster_names.get(i, f"Cluster {i}"),
                              markerfacecolor=scatter1.cmap(scatter1.norm(i))) for i in np.unique(y)]
        ax1.legend(title="Clusters", handles=handles, loc="upper right")
        ax2.legend(title="Clusters", handles=handles, loc="upper right")
    else:
        # Fallback to default numeric legends
        legend1 = ax1.legend(*scatter1.legend_elements(), title="Clusters", loc="upper right")
        ax1.add_artist(legend1)
        legend2 = ax2.legend(*scatter2.legend_elements(), title="Clusters", loc="upper right")
        ax2.add_artist(legend2)

    # Save and display
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Cluster visualization successfully saved to:\n{save_path}")
    plt.show()

if __name__ == "__main__":
    # --- 1. Fetch Real Data from the Optiasset API ---
    # This script now pulls live data from your running application.
    # Ensure the FastAPI server is running before executing this script.
    API_URL = "http://127.0.0.1:8000/api/system/cluster-data"
    print(f"Attempting to fetch cluster data from {API_URL}...")

    try:
        response = requests.get(API_URL, timeout=10)
        
        # Handle graceful API errors (like 404 No Data) before checking raise_for_status
        if not response.ok:
            try:
                error_msg = response.json().get("detail", response.reason)
            except ValueError:
                error_msg = response.reason
            print(f"❌ API Error ({response.status_code}): {error_msg}")
            sys.exit(1)
            
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)

        data = response.json()
        X_real = np.array(data['features'])
        y_real = np.array(data['labels'])

        if X_real.size == 0 or y_real.size == 0:
            print("❌ Error: API returned empty data. Have you run a bulk diagnostic on your assets?")
        else:
            print(f"✅ Successfully fetched {len(y_real)} data points.")
            print(f"Feature matrix shape: {X_real.shape}")

            # --- 2. Define Output Path ---
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_file = os.path.join(script_dir, "cluster_visualization.png")

            # --- 3. Generate and Save Plot ---
            # Map the cluster IDs from the data to the meaningful names from your documentation
            # for a publication-quality graphic.
            cluster_name_map = {
                0: "Healthy",
                1: "Critical",
                2: "Warning"
            }
            # Note: Double-check this mapping against your cluster centroid analysis.
            # The colors in the plot will now correspond to these names.

            plot_clusters(X_real, y_real, output_file, cluster_names=cluster_name_map)

    except requests.exceptions.RequestException as e:
        print(f"❌ Error: Could not connect to the API at {API_URL}.")
        print("Please ensure the Optiasset backend server is running and accessible.")
        print(f"Details: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")