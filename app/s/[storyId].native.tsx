import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { getFirstParam } from '../../lib/routerParams';

export default function SharedStoryNativeRedirect() {
    const { storyId: storyIdParam } = useLocalSearchParams<{ storyId?: string | string[] }>();
    const storyId = useMemo(() => getFirstParam(storyIdParam), [storyIdParam]);

    if (!storyId) return <Redirect href="/" />;
    return <Redirect href={{ pathname: '/library/[storyId]', params: { storyId } }} />;
}
