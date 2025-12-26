'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// This is a placeholder for the actual file content.
// In a real application, you would fetch this from the server.
const initialCssContent = `/*
 * Custom Overrides
 *
 * Use this file to add your own custom CSS to override Tailwind or component styles.
 * Rules in this file will be loaded last, giving them higher priority.
 *
 * Example:
 * To reduce the padding on all card content areas, you could add:
 *
 * .card-content-override {
 *   padding: 0.5rem !important;
 * }
 *
 * And then apply the \`card-content-override\` class to the components you want to change.
 * Or, for a more global change, you can target the default classes directly:
 *
 * .p-4 {
 *    padding: 0.5rem !important;
 * }
 *
 */
`;


export default function CssOverridesPage() {
    const { toast } = useToast();
    const [cssContent, setCssContent] = React.useState(initialCssContent);
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        // In a real app, this would be an API call to a server action
        // that writes to the `custom-overrides.css` file.
        // For Studio, the user prompt following this action will trigger
        // the agent to update the file content.
        console.log("Saving CSS content:", cssContent);
        
        // We can apply the styles dynamically to the head for a live preview effect
        const styleElement = document.getElementById('custom-overrides-style');
        if (styleElement) {
            styleElement.innerHTML = cssContent;
        } else {
            const newStyleElement = document.createElement('style');
            newStyleElement.id = 'custom-overrides-style';
            newStyleElement.innerHTML = cssContent;
            document.head.appendChild(newStyleElement);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        setIsSaving(false);
        toast({ title: 'CSS Saved!', description: 'Your custom styles have been applied. You can now prompt me to use these styles in the app.' });
    };

    return (
        <main className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Custom CSS Overrides</CardTitle>
                    <CardDescription>
                        Add your own CSS rules here to manually override the default application styles. These styles will be loaded last, giving them the highest priority.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        value={cssContent}
                        onChange={(e) => setCssContent(e.target.value)}
                        className="font-mono min-h-[400px]"
                        placeholder="e.g., .my-custom-class { background-color: blue; }"
                    />
                     <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save & Apply Styles'}
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
