import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Scan,
  CheckCircle,
  XCircle,
  Recycle,
  Trash2,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const compressImage = (
  file: File,
  maxSize: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) return;
      img.src = e.target.result as string;
    };

    img.onload = () => {
      let { width, height } = img;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) return reject("Canvas context error");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject("Compression failed");
        },
        "image/jpeg",
        quality
      );
    };

    reader.onerror = () => reject("Image loading failed");
    reader.readAsDataURL(file);
  });
};

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);

    toast({
      title: "Analyzing image...",
      description: "Please wait while we process your image.",
    });
    setIsScanning(true);

    const coldStartTimeout = setTimeout(() => {
      toast({
        title: "Still processing...",
        description:
          "If this is your first scan in a while, the backend may be cold starting. This can take up to a minute.",
      });
    }, 10000);

    try {
      const compressedBlob = await compressImage(file, 512, 0.7);
      const formData = new FormData();
      formData.append(
        "file",
        new File([compressedBlob as Blob], file.name, { type: "image/jpeg" })
      );

      clearTimeout(coldStartTimeout);
      const { data, error } = await supabase.functions.invoke("classify-scan", { body: formData });
      if (error) throw error;
      const scanResult = {
        item: data.item || "Unknown Item",
        recyclable: data.recyclable || false,
        confidence: data.confidence || 0,
        category: data.category || "Unknown",
        instructions: data.instructions || "No instructions available",
        tips: data.recyclable
          ? [
              "Check your local recycling guidelines",
              "Clean the item before recycling",
              "Remove any non-recyclable parts",
            ]
          : [
              "Place in regular trash bin",
              "Do not attempt to recycle this item",
            ],
        impact: {
          co2Saved: "0.2 kg",
          energySaved: "1.2 kWh",
        },
      };

      setResult(scanResult);

      toast({
        title: "Analysis complete!",
        description: `${scanResult.item} is ${
          scanResult.recyclable ? "recyclable" : "not recyclable"
        }.`,
      });
    } catch (err) {
      clearTimeout(coldStartTimeout);
      console.error("Error analyzing image:", err);
      toast({
        title: "Error",
        description: "Failed to analyze image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsScanning(true);

    // Simulate search
    setTimeout(async () => {
      const isRecyclable = Math.random() > 0.3;
      const searchResult = {
        item: searchQuery,
        recyclable: isRecyclable,
        confidence: Math.floor(Math.random() * 20) + 80,
        category: isRecyclable ? "Recyclable" : "Trash",
        instructions: isRecyclable
          ? "This item can be recycled at most facilities"
          : "This item should be disposed of in regular trash",
        tips: isRecyclable
          ? [
              "Check your local recycling guidelines",
              "Clean the item before recycling",
              "Remove any non-recyclable parts",
            ]
          : [
              "Place in regular trash bin",
              "Do not attempt to recycle this item",
            ],
        impact: {
          co2Saved: "0.2 kg",
          energySaved: "1.2 kWh",
        },
      };

      setResult(searchResult);
      setIsScanning(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
      {/* Hidden file input used by the Take Photo / Upload buttons */}
      {/* (Consolidated to a single input below in the Scanner Card) */}
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Eco Scanner</h1>
        <p className="text-muted-foreground">
          Identify recyclable items with AI
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search for an item (e.g., 'aluminum can')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 px-4 py-2 rounded-lg border border-input bg-background"
            />
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-eco-primary to-eco-secondary text-white"
              disabled={isScanning || !searchQuery.trim()}
            >
              <Scan className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanner Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center space-y-6">
            {!isScanning && !result && (
              <>
                <div className="w-32 h-32 mx-auto bg-gradient-to-r from-eco-primary to-eco-secondary rounded-full flex items-center justify-center animate-bounce-soft">
                  <Scan className="w-16 h-16 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Scan</h3>
                  <p className="text-muted-foreground mb-6">
                    Upload an image or search for an item to identify if it's
                    recyclable
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-eco-primary to-eco-secondary text-white h-14"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 border-primary/30"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Upload Image
                    </Button>
                  </div>
                </div>
              </>
            )}

            {isScanning && (
              <div className="space-y-4 animate-scale-in">
                <div className="w-32 h-32 mx-auto bg-gradient-to-r from-eco-primary to-eco-secondary rounded-full flex items-center justify-center animate-pulse">
                  <Scan className="w-16 h-16 text-white animate-spin" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Analyzing...</h3>
                  <p className="text-muted-foreground">
                    AI is identifying your item
                  </p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-slide-up">
                <div
                  className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center ${
                    result.recyclable
                      ? "bg-gradient-to-r from-green-500 to-green-600"
                      : "bg-gradient-to-r from-red-500 to-red-600"
                  }`}
                >
                  {result.recyclable ? (
                    <Recycle className="w-16 h-16 text-white" />
                  ) : (
                    <Trash2 className="w-16 h-16 text-white" />
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {result.item}
                  </h3>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Badge
                      variant={result.recyclable ? "default" : "destructive"}
                      className="text-lg px-4 py-1"
                    >
                      {result.recyclable ? "Recyclable" : "Not Recyclable"}
                    </Badge>
                  </div>
                </div>

                {/* Tips */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      {result.recyclable ? "Recycling Tips" : "Disposal Tips"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.tips.map((tip: string, index: number) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button
                  onClick={() => {
                    setResult(null);
                    setImageFile(null);
                  }}
                  className="w-full bg-gradient-to-r from-eco-primary to-eco-secondary text-white"
                >
                  Scan Another Item
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
