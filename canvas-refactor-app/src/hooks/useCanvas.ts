import { useEffect, useRef, useState } from 'react';

const useCanvas = (width: number, height: number) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                setContext(ctx);
                canvasRef.current.width = width;
                canvasRef.current.height = height;
            }
        }
    }, [width, height]);

    const clearCanvas = () => {
        if (context) {
            context.clearRect(0, 0, width, height);
        }
    };

    const draw = (drawFunction: (ctx: CanvasRenderingContext2D) => void) => {
        if (context) {
            drawFunction(context);
        }
    };

    return { canvasRef, clearCanvas, draw };
};

export default useCanvas;