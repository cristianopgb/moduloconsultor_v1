// This file contains utility functions related to the canvas, such as data manipulation and calculations necessary for the functioning of the components.

export const drawRectangle = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
};

export const clearCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
};

export const drawCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
};

export const getMousePosition = (canvas: HTMLCanvasElement, event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
};