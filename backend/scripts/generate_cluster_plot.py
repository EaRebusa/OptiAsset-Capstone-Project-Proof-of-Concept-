import os
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.datasets import make_blobs

def plot_clusters(X, y, save_path):
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
    legend1 = ax1.legend(*scatter1.legend_elements(), title="Clusters", loc="upper right")
    ax1.add_artist(legend1)

    # --- 3D Plot ---
    ax2 = fig.add_subplot(1, 2, 2, projection='3d')
    scatter2 = ax2.scatter(X_3d[:, 0], X_3d[:, 1], X_3d[:, 2], c=y, cmap='viridis', alpha=0.8, edgecolors='k', s=50)
    ax2.set_title('3D Cluster Scatter Plot')
    ax2.set_xlabel('Principal Component 1')
    ax2.set_ylabel('Principal Component 2')
    ax2.set_zlabel('Principal Component 3')
    legend2 = ax2.legend(*scatter2.legend_elements(), title="Clusters", loc="upper right")
    ax2.add_artist(legend2)

    # Save and display
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Cluster visualization successfully saved to:\n{save_path}")
    plt.show()

if __name__ == "__main__":
    # -------------------------------------------------------------------
    # Note: Replace this mock data block with your actual Optiasset data
    # X should be your feature matrix, y should be your cluster labels.
    # -------------------------------------------------------------------
    print("Generating synthetic cluster data for visualization...")
    X_mock, y_mock = make_blobs(
        n_samples=600, centers=3, n_features=15, random_state=42, cluster_std=2.5
    )
    
    # Save the output image in the same directory as the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "cluster_visualization.png")
    
    plot_clusters(X_mock, y_mock, output_file)