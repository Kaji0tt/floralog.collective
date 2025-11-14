
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Camera, BookOpen, Map, Home, Target, Award, User, UserPlus } from "lucide-react"; 
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";

const LOGO_URL = "https://blauzahn.eu/PlantDexIcon.png";

const mainNavigation = [
  {
    title: "Start",
    url: createPageUrl("Home"),
    icon: Home,
  },
  {
    title: "Scannen",
    url: createPageUrl("Scanner"),
    icon: Camera,
  },
];

const collectionNavigation = [
  {
    title: "Dex",
    url: createPageUrl("Collection"),
    icon: BookOpen,
  },
  {
    title: "Karte",
    url: createPageUrl("Map"),
    icon: Map,
  },
];

const progressNavigation = [
  {
    title: "Profil",
    url: createPageUrl("Profile"),
    icon: User,
  },
  {
    title: "Aufgaben",
    url: createPageUrl("Quests"),
    icon: Target,
  },
  {
    title: "Erfolge",
    url: createPageUrl("Achievements"),
    icon: Award,
  },
];

const socialNavigation = [
  {
    title: "Freunde",
    url: createPageUrl("Friends"),
    icon: UserPlus,
  },
  // Removed "Klasse" item as per instructions
  // {
  //   title: "Klasse",
  //   url: createPageUrl("Classroom"),
  //   icon: Users,
  // },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --forest-green: #2D5016;
          --sage-green: #4A7C2E;
          --moss-green: #6B8E3D;
          --leaf-green: #7FA650;
          --amber: #D97706;
          --cream: #FAFAF9;
        }
        
        body {
          overflow-x: hidden;
        }

        /* Hide sidebar on mobile */
        @media (max-width: 768px) {
          [data-sidebar="sidebar"] {
            display: none !important;
          }
        }

        /* Hide scrollbar for snap scroll */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-stone-50 overflow-x-hidden">
        {/* Sidebar - nur auf Desktop sichtbar */}
        <Sidebar className="border-r border-stone-200 bg-white hidden md:flex">
          <SidebarHeader className="border-b border-stone-200 p-6">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 flex items-center justify-center bg-white rounded-lg">
                <img src={LOGO_URL} alt="PlantDex Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-stone-900">PlantDex</h2>
                <p className="text-xs text-stone-500">Mitteleuropäische Flora</p>
              </div>
            </Link>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {/* Haupt-Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-stone-500 uppercase tracking-wider px-4 mb-2">
                Hauptmenü
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavigation.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-green-50 transition-colors rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'text-stone-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-semibold">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Sammlung */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-stone-500 uppercase tracking-wider px-4 mb-2 mt-4">
                Sammlung
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collectionNavigation.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-green-50 transition-colors rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'text-stone-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-semibold">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Fortschritt */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-stone-500 uppercase tracking-wider px-4 mb-2 mt-4">
                Fortschritt
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {progressNavigation.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-green-50 transition-colors rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'text-stone-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-semibold">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Soziales */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-stone-500 uppercase tracking-wider px-4 mb-2 mt-4">
                Soziales
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {socialNavigation.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-green-50 transition-colors rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'text-stone-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-semibold">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* SidebarFooter entfernt - Spenden/Impressum nur auf Startseite */}
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-x-hidden">
          {/* Mobile Header - entfernt, da nicht mehr benötigt */}
          {/* The previous header content for mobile was removed as per the instructions */}

          <div className="flex-1 overflow-auto overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
