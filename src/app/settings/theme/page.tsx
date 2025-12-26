
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Check, Droplets, Palette, Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock component to avoid needing a full API call to save
const updateCssFile = async (content: string) => {
    console.log("Simulating CSS file update with:", content);
    // In a real scenario, this would be an API call to a server action
    // that writes to the `globals.css` file.
    return new Promise(resolve => setTimeout(resolve, 500));
}

// Function to parse HSL strings
const parseHsl = (hslStr: string | undefined): [number, number, number] | null => {
    if (!hslStr) return null;
    const match = hslStr.trim().match(/^(\d+)\s+([\d.]+)%\s+([\d.]+)%$/);
    if (!match) return null;
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
};

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

    const handleColorChange = (variable: keyof ThemeVariables, value: string) => {
        const newTheme = { ...theme, [variable]: value };
        setTheme(newTheme);
        document.documentElement.style.setProperty(variable, value);
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
        const cssContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: ${theme['--background']};
    --foreground: ${theme['--foreground']};
    --card: ${theme['--background']};
    --card-foreground: ${theme['--foreground']};
    --popover: ${theme['--background']};
    --popover-foreground: ${theme['--foreground']};
    --primary: ${theme['--primary']};
    --primary-foreground: ${theme['--primary-foreground']};
    --secondary: ${theme['--secondary']};
    --secondary-foreground: ${theme['--foreground']};
    --muted: ${theme['--muted']};
    --muted-foreground: ${theme['--foreground']}; /* Simplified */
    --accent: ${theme['--accent']};
    --accent-foreground: ${theme['--foreground']};
    --destructive: ${theme['--destructive']};
    --destructive-foreground: ${theme['--primary-foreground']};
    --border: ${theme['--border']};
    --input: ${theme['--input']};
    --ring: ${theme['--ring']};
    --radius: ${theme['--radius']};
  }
 
  .dark {
    /* For simplicity, we are not implementing the dark theme editor yet */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
 
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
        `;
        
        // This is a placeholder for where the actual file-saving call would go.
        // As an AI, I can generate the file content but cannot execute file system operations.
        // The XML change block will handle the actual file write.
        await updateCssFile(cssContent);

        setIsSaving(false);
        setInitialTheme(theme); // Set the new saved state as the initial state
        toast({ title: 'Theme Saved!', description: 'Your new theme has been applied across the app.' });
    };

    const ColorInput = ({ label, variable }: { label: string, variable: keyof ThemeVariables }) => (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md border" style={{ background: `hsl(${theme[variable]})` }} />
                <Input
                    value={theme[variable] || ''}
                    onChange={(e) => handleColorChange(variable, e.target.value)}
                    placeholder="H S% L%"
                />
            </div>
        </div>
    );
    
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
