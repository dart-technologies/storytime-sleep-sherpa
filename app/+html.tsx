import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren, useMemo } from 'react';
import { joinUrl } from '../lib/cloudFunctions';
import { getWebBaseUrlFromEnv } from '../lib/shareLinks';

const DEFAULT_TITLE = 'Storytime';
const DEFAULT_DESCRIPTION = 'Open a shared Storytime link to listen to a sleep story in your browser.';

export default function RootHtml({ children }: PropsWithChildren) {
    const baseUrl = useMemo(() => getWebBaseUrlFromEnv(), []);
    const ogImageUrl = baseUrl ? joinUrl(baseUrl, '/og.png') : undefined;

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <ScrollViewStyleReset />

                <title>{DEFAULT_TITLE}</title>
                <meta name="description" content={DEFAULT_DESCRIPTION} />

                <meta property="og:site_name" content={DEFAULT_TITLE} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={DEFAULT_TITLE} />
                <meta property="og:description" content={DEFAULT_DESCRIPTION} />
                {baseUrl ? <meta property="og:url" content={baseUrl} /> : null}
                {ogImageUrl ? <meta property="og:image" content={ogImageUrl} /> : null}

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={DEFAULT_TITLE} />
                <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
                {ogImageUrl ? <meta name="twitter:image" content={ogImageUrl} /> : null}
            </head>
            <body>{children}</body>
        </html>
    );
}
