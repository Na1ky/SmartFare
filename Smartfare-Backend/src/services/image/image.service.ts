import axios from 'axios';

export class ImageService {
    private unsplashAccessKey: string;
    private readonly UNSPLASH_API_BASE = 'https://api.unsplash.com/search/photos';

    constructor() {
        this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || '';
        if (!this.unsplashAccessKey) {
            console.warn('⚠️  UNSPLASH_ACCESS_KEY not configured. Location images will use defaults.');
        }
    }

    /**
     * Fetches a random image URL from Unsplash for a given location
     * Returns null if API fails or key is missing
     */
    async getLocationImage(locationName: string): Promise<string | null> {
        if (!this.unsplashAccessKey) {
            return null; // API key not configured
        }

        try {
            const response = await axios.get(this.UNSPLASH_API_BASE, {
                params: {
                    query: locationName,
                    client_id: this.unsplashAccessKey,
                    per_page: 30, // Fetch multiple results to randomize
                    orientation: 'landscape'
                },
                timeout: 5000 // 5 second timeout
            });

            if (response.data.results && response.data.results.length > 0) {
                // Select a random image from results
                const randomIndex = Math.floor(Math.random() * response.data.results.length);
                const imageUrl = response.data.results[randomIndex].urls.regular;
                return imageUrl;
            }

            return null; // No results found
        } catch (error) {
            console.error(
                `Failed to fetch image for location "${locationName}":`,
                error instanceof Error ? error.message : 'Unknown error'
            );
            return null; // Return null on error
        }
    }

    /**
     * Fetches a location image, returns null if unavailable
     */
    async getLocationImageWithFallback(
        locationName: string,
        fallbackUrl: string
    ): Promise<string> {
        const imageUrl = await this.getLocationImage(locationName);
        return imageUrl || fallbackUrl;
    }
}
