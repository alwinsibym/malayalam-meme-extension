declare module 'sound-play' {
    export function play(path: string, volume?: number): Promise<void>;
}
