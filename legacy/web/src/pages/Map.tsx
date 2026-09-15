import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Search, 
  Navigation,
  Clock,
  Phone,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RecyclingCenter = Database["public"]["Tables"]["recycling_centers"]["Row"];

export default function Map() {
  const [searchParams] = useSearchParams();
  const [centers, setCenters] = useState<RecyclingCenter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<RecyclingCenter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCenters();
    
    const centerId = searchParams.get('center');
    if (centerId) {
      fetchCenterById(centerId);
    }
  }, [searchParams]);

  const fetchCenters = async () => {
    const { data } = await supabase
      .from('recycling_centers')
      .select('*')
      .order('name');

    setCenters(data || []);
    setLoading(false);
  };

  const fetchCenterById = async (id: string) => {
    const { data } = await supabase
      .from('recycling_centers')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setSelectedCenter(data);
    }
  };

  const getDirections = (center: RecyclingCenter) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`;
    window.open(url, '_blank');
  };

  const filteredCenters = searchQuery
    ? centers.filter(center => 
        center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.accepted_materials.some((m: string) => 
          m.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : centers;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Recycling Centers</h1>
        <p className="text-muted-foreground">Find the nearest recycling location</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search by name, location, or material..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Map Embed */}
      <Card className="overflow-hidden">
        <div className="w-full h-64 bg-muted">
          <iframe
            src={selectedCenter 
              ? `https://www.google.com/maps?q=${selectedCenter.latitude},${selectedCenter.longitude}&z=15&output=embed`
              : "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d193595.15830869428!2d-74.006138!3d40.710059!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1234567890"
            }
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
      </Card>

      {/* Centers List */}
      <div className="space-y-4">
        {filteredCenters.map((center) => (
          <Card 
            key={center.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedCenter?.id === center.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedCenter(center)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{center.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{center.address}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      getDirections(center);
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Directions
                  </Button>
                </div>

                {/* Accepted Materials */}
                <div className="flex flex-wrap gap-1">
                  {center.accepted_materials.map((material: string) => (
                    <Badge key={material} variant="secondary" className="text-xs">
                      {material}
                    </Badge>
                  ))}
                </div>

                {/* Details */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {center.hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{center.hours}</span>
                    </div>
                  )}
                  {center.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{center.phone}</span>
                    </div>
                  )}
                  {center.website && (
                    <a 
                      href={center.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Website</span>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCenters.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No centers found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or check back later
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
