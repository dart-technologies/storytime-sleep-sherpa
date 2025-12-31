import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Theme } from '../../constants/Theme';

function TabLayout() {
    return (
        <NativeTabs
            blurEffect="systemChromeMaterialDark"
            iconColor={{
                selected: Theme.colors.white,
                default: Theme.colors.textMuted,
            }}
            labelStyle={{
                selected: { color: Theme.colors.white },
                default: { color: Theme.colors.textMuted },
            }}
            minimizeBehavior="automatic"
        >
            <NativeTabs.Trigger
                name="create"
                options={{
                    title: 'Create',
                }}
            >
                <Label>Create</Label>
                <Icon sf="sparkles" />
            </NativeTabs.Trigger>

            <NativeTabs.Trigger
                name="library"
                options={{
                    title: 'My Dreams',
                }}
            >
                <Label>My Dreams</Label>
                <Icon sf="book" />
            </NativeTabs.Trigger>

            <NativeTabs.Trigger
                name="featured"
                options={{
                    title: 'Featured',
                }}
            >
                <Label>Featured</Label>
                <Icon sf="star" />
            </NativeTabs.Trigger>

            <NativeTabs.Trigger
                name="settings"
                options={{
                    title: 'Settings',
                }}
            >
                <Label>Settings</Label>
                <Icon sf="person.circle" />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}

export default React.memo(TabLayout);
