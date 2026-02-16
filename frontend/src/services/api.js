import axios from 'axios';

// FastAPI default address
const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const assetService = {
    /**
     * Fetches all assets from the DB.
     * Includes the 'current_age' calculated by the backend.
     */
    getAllAssets: async () => {
        try {
            const response = await api.get('/assets/');
            return response.data;
        } catch (error) {
            console.error("Failed to fetch assets:", error);
            throw error;
        }
    },

    /**
     * Triggers the ML Diagnostic engine for a specific asset.
     */
    diagnoseAsset: async (assetId) => {
        try {
            const response = await api.post(`/assets/${assetId}/diagnose`);
            return response.data;
        } catch (error) {
            console.error(`Diagnostic failed for ${assetId}:`, error);
            throw error;
        }
    }
};

export default api;