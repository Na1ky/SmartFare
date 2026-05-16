import { createApp } from './src/app';

const PORT = process.env.PORT || 3456;
const app = createApp();

function startServer() {
    try {
        app.listen(PORT, () => {
            console.log(`🗺️ Server avviato su http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Errore avvio server:', error);
        process.exit(1);
    }
}

startServer();