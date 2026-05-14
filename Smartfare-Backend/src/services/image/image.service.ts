import axios from 'axios';

export class ImageService {
    private unsplashAccessKey: string;
    private readonly UNSPLASH_API_BASE = 'https://api.unsplash.com/search/photos';
    private readonly fallbackImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1500673922987-e212871fec22?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop'
    ];

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

    getDefaultLocationImage(locationName: string): string {
        const normalized = locationName.toLowerCase();

        if (normalized.includes('spiaggia') || normalized.includes('mare') || normalized.includes('isola')) {
            return this.fallbackImages[5];
        }

        if (normalized.includes('mont') || normalized.includes('alp') || normalized.includes('dolom') || normalized.includes('lake')) {
            return this.fallbackImages[4];
        }

        if (normalized.includes('muse') || normalized.includes('arte') || normalized.includes('stor')) {
            return this.fallbackImages[3];
        }

        if (normalized.includes('borg') || normalized.includes('mediev') || normalized.includes('centro') || normalized.includes('citt')) {
            return this.fallbackImages[1];
        }

        const hash = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return this.fallbackImages[hash % this.fallbackImages.length];
    }
}
