// Shared Tailwind CSS configuration for all UniFlow pages
// Loaded via Tailwind CDN - this must be set before tailwind processes the page

function initTailwind() {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                "colors": {
                    "surface-tint": "#cfbdf8",
                    "error-container": "#93000a",
                    "tertiary-container": "#f9bcd6",
                    "on-error": "#690005",
                    "inverse-primary": "#655689",
                    "surface-container-lowest": "#0e0d16",
                    "on-primary": "#362858",
                    "on-tertiary-fixed-variant": "#65394e",
                    "on-tertiary": "#4b2337",
                    "on-tertiary-container": "#77495e",
                    "on-primary-container": "#5d4f81",
                    "on-primary-fixed": "#201242",
                    "secondary-container": "#014c6b",
                    "surface-dim": "#13121b",
                    "surface-container-low": "#1c1a24",
                    "secondary": "#96cdf2",
                    "secondary-fixed": "#c6e7ff",
                    "outline-variant": "#49454e",
                    "primary-container": "#d6c4ff",
                    "surface-variant": "#35343e",
                    "tertiary-fixed": "#ffd8e7",
                    "surface-bright": "#3a3842",
                    "inverse-on-surface": "#312f39",
                    "background": "#13121b",
                    "on-secondary-fixed": "#001e2d",
                    "surface-container-high": "#2a2933",
                    "on-surface": "#e5e0ee",
                    "on-secondary-fixed-variant": "#014c6b",
                    "primary": "#efe5ff",
                    "secondary-fixed-dim": "#96cdf2",
                    "on-secondary": "#00344b",
                    "primary-fixed-dim": "#cfbdf8",
                    "inverse-surface": "#e5e0ee",
                    "on-tertiary-fixed": "#330e22",
                    "surface-container-highest": "#35343e",
                    "primary-fixed": "#e9ddff",
                    "on-background": "#e5e0ee",
                    "on-primary-fixed-variant": "#4d3e70",
                    "tertiary-fixed-dim": "#f2b6cf",
                    "tertiary": "#ffe2ec",
                    "on-surface-variant": "#cac4cf",
                    "surface": "#13121b",
                    "on-secondary-container": "#85bce0",
                    "outline": "#948f99",
                    "surface-container": "#201e28",
                    "error": "#ffb4ab",
                    "on-error-container": "#ffdad6"
                },
                "borderRadius": {
                    "DEFAULT": "1rem",
                    "lg": "2rem",
                    "xl": "3rem",
                    "full": "9999px"
                },
                "spacing": {
                    "margin-mobile": "16px",
                    "unit": "8px",
                    "margin-desktop": "40px",
                    "gutter": "24px"
                },
                "fontFamily": {
                    "label-sm": ["Plus Jakarta Sans"],
                    "display-lg": ["Plus Jakarta Sans"],
                    "headline-lg": ["Plus Jakarta Sans"],
                    "headline-lg-mobile": ["Plus Jakarta Sans"],
                    "body-md": ["Plus Jakarta Sans"],
                    "body-lg": ["Plus Jakarta Sans"]
                },
                "fontSize": {
                    "label-sm": ["12px", {"lineHeight": "16px", "letterSpacing": "0.03em", "fontWeight": "600"}],
                    "display-lg": ["46px", {"lineHeight": "54px", "letterSpacing": "-0.01em", "fontWeight": "700"}],
                    "headline-lg": ["30px", {"lineHeight": "38px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "26px", "fontWeight": "400"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}]
                }
            },
        },
    };
}