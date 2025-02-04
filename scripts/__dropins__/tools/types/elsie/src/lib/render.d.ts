import { VNode } from 'preact';
import { Container } from '.';

/**
 * The `Render` class provides methods to render and unmount components, as well as to render components to a string.
 * @class
 *
 * @property {Function} render - Renders a component to a root element.
 * @property {Function} unmount - Unmounts a component from a root element.
 * @property {Function} toString - Renders a component to a string.
 */
export declare class Render {
    private _provider;
    constructor(provider: VNode<any>);
    /**
     * Renders a component to a root element.
     * @param Component - The component to render.
     * @param props - The component props.
     */
    render<T>(Component: Container<T>, props: T): (rootElement: HTMLElement) => Promise<void>;
    /**
     * Unmounts a component from a root element.
     * @param rootElement - The root element to unmount the component from.
     */
    unmount(rootElement: HTMLElement): void;
    /**
     * Renders a component to a string.
     * @param Component - The component to render.
     * @param props - The component props.
     * @param options - Optional rendering options.
     */
    toString<T>(Component: Container<T>, props: T, options?: T): Promise<string>;
}
//# sourceMappingURL=render.d.ts.map