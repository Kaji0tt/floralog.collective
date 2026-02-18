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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-stone-50 to-green-50">
        <div className="animate-spin text-green-600">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-green-50 p-4 md:p-8">
      <MobileBackButton />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-3 flex items-center justify-center gap-3">
            <Newspaper className="w-10 h-10 text-green-600" />
            Neuigkeiten
          </h1>
          <p className="text-lg text-stone-600">
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