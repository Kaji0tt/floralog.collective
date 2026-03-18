import React, { useState, useEffect } from "react";
import { Query } from "@/api/entities";
import { getCurrentUser } from "@/api/userApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Trash2, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MobileBackButton from "../components/navigation/MobileBackButton";
import { Button } from "@/components/ui/button";

export default function News() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: news = [], isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: () => Query.News.list('-created_date'),
  });

  const deleteNewsMutation = useMutation({
    mutationFn: (newsId) => Query.News.delete(newsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const parseCssColorToRgb = (colorString) => {
    if (!colorString || typeof colorString !== 'string') return null;
    const color = colorString.trim();

    const rgbMatch = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      return {
        r: Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))),
        g: Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))),
        b: Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))),
      };
    }

    const hexMatch = color.match(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
      }

      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }

    return null;
  };

  const getRgbaFromColor = (colorString, opacity) => {
    const rgb = parseCssColorToRgb(colorString);
    if (!rgb) return colorString;
    const safeOpacity = typeof opacity === 'number' ? Math.min(1, Math.max(0, opacity)) : 1;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeOpacity})`;
  };

  const isColorDark = (colorString) => {
    const rgb = parseCssColorToRgb(colorString);
    if (!rgb) return false;
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 130;
  };

  const hasProfileBackgroundColor = Boolean(user?.background_color);
  const headlineColor = hasProfileBackgroundColor && isColorDark(user.background_color) ? 'rgb(255, 255, 255)' : 'rgb(28, 25, 23)';
  const subtitleColor = hasProfileBackgroundColor && isColorDark(user.background_color) ? 'rgba(255, 255, 255, 0.88)' : 'rgb(87, 83, 78)';
  const pageBackgroundStyle = hasProfileBackgroundColor
    ? {
        background: `linear-gradient(135deg, ${getRgbaFromColor(user.background_color, 0.72)} 0%, ${getRgbaFromColor(user.background_color, 1)} 100%)`,
      }
    : {};

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <div className="animate-spin text-green-600">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8" style={pageBackgroundStyle}>
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3" style={{ color: headlineColor }}>
            <Newspaper className="w-10 h-10" style={{ color: headlineColor }} />
            Neuigkeiten
          </h1>
          <p className="text-lg" style={{ color: subtitleColor }}>
            Bleib auf dem Laufenden über Updates und neue Features
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-stone-600">Lade Neuigkeiten...</div>
          </div>
        ) : news.length === 0 ? (
          <Card className="border-2 border-stone-200 shadow-lg bg-white">
            <CardContent className="p-12 text-center">
              <Newspaper className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-600 text-lg">Noch keine Neuigkeiten verfügbar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <AnimatePresence>
              {news.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-2 border-stone-200 shadow-lg bg-white hover:shadow-xl transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold text-stone-900 mb-3">
                            {item.title}
                          </h2>
                          <p className="text-stone-700 leading-relaxed whitespace-pre-wrap mb-4">
                            {item.text}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                            <Calendar className="w-4 h-4" />
                            {formatDate(item.created_date)}
                          </div>
                        </div>
                        
                        {user?.role === 'admin' && (
                          <Button
                            onClick={() => {
                              if (window.confirm('Möchtest du diese Neuigkeit wirklich löschen?')) {
                                deleteNewsMutation.mutate(item.id);
                              }
                            }}
                            variant="outline"
                            size="icon"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-shrink-0"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}