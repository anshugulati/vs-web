import { FunctionComponent } from 'preact';
import { HTMLAttributes } from 'preact/compat';
import { Lang } from '../../i18n';

export declare const UIContext: import('preact').Context<{
    locale: string;
}>;
type LangDefinitions = {
    [key: string]: any;
};
export interface UIProviderProps extends HTMLAttributes<HTMLDivElement> {
    lang?: Lang;
    langDefinitions?: LangDefinitions;
}
export declare const UIProvider: FunctionComponent<UIProviderProps>;
export {};
//# sourceMappingURL=UIProvider.d.ts.map