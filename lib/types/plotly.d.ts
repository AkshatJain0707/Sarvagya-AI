// lib/types/plotly.d.ts
declare module 'react-plotly.js' {
    import * as React from 'react';
    interface PlotlyProps {
        data: any[];
        layout?: any;
        config?: any;
        useResizeHandler?: boolean;
        className?: string;
        style?: React.CSSProperties;
    }
    export default class Plot extends React.Component<PlotlyProps> { }
}
