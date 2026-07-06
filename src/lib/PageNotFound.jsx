import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/api/userApi';
import { useQuery } from '@tanstack/react-query';
import { PAGES } from '@/pages.config';

const ADMIN_PAGES = new Set([
    'AdminBackup', 'AdminBlumenList', 'AdminCategoryFix', 'AdminFixDuplicateGenusNumbers',
    'AdminFixSalix', 'AdminPlantImporter', 'AdminPlantNames', 'AdminQuestCreator',
    'AdminScanOfTheWeek', 'AdminWeeklyReport', 'KPIAdmin', 'NewsAdmin', 'ProjectIssueAdmin',
    'DebugDiscoveries', 'ResetAccount', 'ResetToLevel5', 'XPMigration', 'QuestNotificationTemplate',
]);

export default function PageNotFound() {
    const location = useLocation();
    const navigate = useNavigate();
    const pageName = location.pathname.substring(1);
    const [showRoutes, setShowRoutes] = useState(false);
    const [search, setSearch] = useState('');

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await getCurrentUser();
                return { user, isAuthenticated: true };
            } catch {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    const isAdmin = isFetched && authData?.isAuthenticated && authData?.user?.role === 'admin';

    const allRoutes = Object.keys(PAGES).filter(key => {
        if (ADMIN_PAGES.has(key) && !isAdmin) return false;
        return true;
    });

    const filteredRoutes = allRoutes.filter(key =>
        key.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen w-full bg-gradient-to-b from-stone-950 via-stone-900 to-emerald-950 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="rounded-3xl border border-emerald-400/20 bg-stone-900/70 backdrop-blur-sm shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="relative px-8 pt-10 pb-6 text-center">
                        {/* Decorative leaf icon */}
                        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-emerald-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M12 3C12 3 5 7 5 13a7 7 0 0014 0c0-6-7-10-7-10z M12 13v8" />
                            </svg>
                        </div>

                        {/* 404 */}
                        <div className="text-7xl font-bold tracking-tighter text-emerald-400/20 select-none leading-none mb-2">
                            404
                        </div>

                        <h1 className="text-xl font-semibold text-stone-100 mb-2">
                            Seite nicht gefunden
                        </h1>

                        {pageName && (
                            <p className="text-stone-400 text-sm leading-relaxed">
                                <span className="font-mono text-emerald-300/80 bg-emerald-900/30 px-2 py-0.5 rounded text-xs">
                                    /{pageName}
                                </span>
                                {' '}existiert nicht in dieser App.
                            </p>
                        )}

                        {/* Admin note */}
                        {isAdmin && (
                            <div className="mt-4 text-left p-3 rounded-xl bg-amber-500/10 border border-amber-400/20">
                                <p className="text-xs text-amber-300 font-medium">Admin-Hinweis</p>
                                <p className="text-xs text-amber-200/70 mt-0.5">
                                    Als Admin haben Sie Zugriff auf zusätzliche Routen. Klicken Sie unten auf "Verfügbare Routen anzeigen", um diese zu sehen.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="px-8 pb-4 flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Zur Startseite
                        </button>

                        {isAdmin && (
                        <button
                            onClick={() => setShowRoutes(v => !v)}
                            className="w-full py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-900 border border-stone-700/60 text-stone-300 text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            {showRoutes ? 'Routen ausblenden' : 'Verfügbare Routen anzeigen'}
                        </button>
                        )}
                    </div>

                    {/* Route list panel */}
                    {isAdmin && showRoutes && (
                        <div className="px-8 pb-8">
                            <div className="border-t border-stone-700/50 pt-4">
                                {/* Search */}
                                <div className="relative mb-3">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Suchen…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-stone-800/80 border border-stone-700/60 text-stone-200 text-sm placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                                    />
                                </div>

                                {/* Route grid */}
                                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {filteredRoutes.length === 0 ? (
                                        <p className="text-stone-500 text-xs text-center py-4">Keine Ergebnisse</p>
                                    ) : (
                                        filteredRoutes.map(key => (
                                            <button
                                                key={key}
                                                onClick={() => navigate(`/${key}`)}
                                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors group flex items-center justify-between"
                                            >
                                                <span className="text-stone-300 group-hover:text-emerald-300 text-sm transition-colors">
                                                    {key}
                                                </span>
                                                <span className="text-stone-600 group-hover:text-emerald-500 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <p className="text-stone-600 text-xs text-center mt-3">
                                    {filteredRoutes.length} Route{filteredRoutes.length !== 1 ? 'n' : ''}
                                    {!isAdmin && <span> &nbsp;·&nbsp; Admin-Seiten ausgeblendet</span>}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}