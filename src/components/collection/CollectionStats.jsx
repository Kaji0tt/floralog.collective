
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, BookOpen, TrendingUp } from "lucide-react";

export default function CollectionStats({ plants }) {
  const totalPlants = plants.length;
  const uniqueFamilies = new Set(plants.map(p => p.family).filter(Boolean)).size;
  const thisMonth = plants.filter(p => {
    const scanDate = new Date(p.scan_date);
    const now = new Date();
    return scanDate.getMonth() === now.getMonth() && scanDate.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    {
      label: "Pflanzen gesamt",
      value: totalPlants,
      icon: Leaf,
      color: "from-green-500 to-emerald-600"
    },
    {
      label: "Pflanzenfamilien",
      value: uniqueFamilies,
      icon: BookOpen,
      color: "from-emerald-500 to-teal-600"
    },
    {
      label: "Diesen Monat",
      value: thisMonth,
      icon: TrendingUp,
      color: "from-teal-500 to-cyan-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className="overflow-hidden border-2 border-gray-100 hover:border-green-200 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
