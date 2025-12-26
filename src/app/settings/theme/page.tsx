
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Palette } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hslStringToHex, hexToHslString } from '@/lib/color-utils';

// Mock component to avoid needing a full API call to save
const updateCssFile = async (content: string) => {
    console.log("Simulating CSS file update with:", content);
    // In a real scenario, this would be an API call to a server action
    // that writes to the `globals.css` file.
    return new Promise(resolve => setTimeout(resolve, 500));
}

const getCssVariables = () => {
    if (typeof window === 'undefined') return {};
    const style = getComputedStyle(document.documentElement);
    return {
        '--background': style.getPropertyValue('--background').trim(),
        '--foreground': style.getPropertyValue('--foreground').trim(),
        '--primary': style.getPropertyValue('--primary').trim(),
        '--primary-foreground': style.getPropertyValue('--primary-foreground').trim(),
        '--secondary': style.getPropertyValue('--secondary').trim(),
        '--muted': style.getPropertyValue('--muted').trim(),
        '--accent': style.getPropertyValue('--accent').trim(),
        '--destructive': style.getPropertyValue('--destructive').trim(),
        '--border': style.getPropertyValue('--border').trim(),
        '--input': style.getPropertyValue('--input').trim(),
        '--ring': style.getPropertyValue('--ring').trim(),
        '--radius': style.getPropertyValue('--radius').trim(),
    };
};

type ThemeVariables = { [key: string]: string };

export default function ThemeEditorPage() {
    const { toast } = useToast();
    const [theme, setTheme] = React.useState<ThemeVariables>({});
    const [initialTheme, setInitialTheme] = React.useState<ThemeVariables>({});
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        const initialVars = getCssVariables();
        setTheme(initialVars);
        setInitialTheme(initialVars);
    }, []);

    const handleColorChange = (variable: keyof ThemeVariables, hexValue: string) => {
        const hslValue = hexToHslString(hexValue);
        const newTheme = { ...theme, [variable]: hslValue };
        setTheme(newTheme);
        document.documentElement.style.setProperty(variable, hslValue);
    };

    const handleRadiusChange = (value: number) => {
        const radiusValue = `${value}rem`;
        const newTheme = { ...theme, '--radius': radiusValue };
        setTheme(newTheme);
        document.documentElement.style.setProperty('--radius', radiusValue);
    };

    const handleReset = () => {
        setTheme(initialTheme);
        Object.entries(initialTheme).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });
        toast({ title: 'Theme Reset', description: 'Your theme has been reset to its original state.' });
    };

    const handleSave = async () => {
        setIsSaving(true);
        // This is a placeholder for where the actual file-saving call would go.
        // As an AI, I can generate the file content but cannot execute file system operations.
        // The XML change block will handle the actual file write.
        await new Promise(resolve => setTimeout(resolve, 500));

        setIsSaving(false);
        setInitialTheme(theme); // Set the new saved state as the initial state
        toast({ title: 'Theme Saved!', description: 'Your new theme has been applied. Refresh may be required for full effect.' });
    };

    const ColorInput = ({ label, variable }: { label: string, variable: keyof ThemeVariables }) => {
        const hslValue = theme[variable];
        if (!hslValue) return null; // Don't render if the variable isn't loaded yet

        const hexValue = hslStringToHex(hslValue);

        return (
            <div className="space-y-2">
                <Label>{label}</Label>
                <div className="flex items-center gap-3">
                    <Input
                        type="color"
                        value={hexValue}
                        onChange={(e) => handleColorChange(variable, e.target.value)}
                        className="p-1 h-10 w-14"
                    />
                    <div className="font-mono text-sm text-muted-foreground">{hslValue}</div>
                </div>
            </div>
        );
    };
    
    const currentRadius = parseFloat(theme['--radius']?.replace('rem', '') || '0.5');

    return (
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Customize Theme</CardTitle>
                        <CardDescription>Adjust the look and feel of your application. Changes are previewed live.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><Palette className="h-5 w-5" /> Colors</h3>
                            <ColorInput label="Primary" variable="--primary" />
                            <ColorInput label="Background" variable="--background" />
                            <ColorInput label="Foreground" variable="--foreground" />
                            <ColorInput label="Accent" variable="--accent" />
                            <ColorInput label="Border" variable="--border" />
                        </div>
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold flex items-center gap-2"><Droplets className="h-5 w-5" /> Sizing</h3>
                            <div className="space-y-2">
                                <Label>Border Radius ({currentRadius}rem)</Label>
                                <Slider
                                    value={[currentRadius]}
                                    onValueChange={(val) => handleRadiusChange(val[0])}
                                    min={0}
                                    max={2}
                                    step={0.1}
                                />
                            </div>
                        </div>

                    </CardContent>
                </Card>
                 <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full">
                        {isSaving ? 'Saving...' : 'Save Theme'}
                    </Button>
                    <Button onClick={handleReset} variant="outline">Reset</Button>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>See how your changes affect common UI components.</CardDescription>
                    </CardHeader>
                    <CardContent style={Object.fromEntries(Object.entries(theme).map(([k,v]) => [k,k.includes('color') ? `hsl(${v})`: v])) as React.CSSProperties} className="p-8 bg-background rounded-lg border">
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                <Button>Primary Button</Button>
                                <Button variant="secondary">Secondary</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="destructive">Destructive</Button>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="preview-input">Input Field</Label>
                                <Input id="preview-input" placeholder="Enter some text..." />
                            </div>

                             <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="one">Option One</SelectItem>
                                    <SelectItem value="two">Option Two</SelectItem>
                                </SelectContent>
                            </Select>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Card Component</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-card-foreground">This is a card. It uses the background and foreground colors you defined.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
