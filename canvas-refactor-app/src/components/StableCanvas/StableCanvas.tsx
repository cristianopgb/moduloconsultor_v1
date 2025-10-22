import React, { useRef, useEffect } from 'react';

const StableCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Configurações iniciais do canvas
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Função para desenhar no canvas
        const draw = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            // Adicione aqui a lógica de desenho
        };

        // Chama a função de desenho
        draw();

        // Adiciona um listener para redimensionamento da janela
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            draw();
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <canvas ref={canvasRef} />;
};

export default StableCanvas;