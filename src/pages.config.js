/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Achievements from './pages/Achievements';
import AdminBackup from './pages/AdminBackup';
import AdminBlumenList from './pages/AdminBlumenList';
import AdminCategoryFix from './pages/AdminCategoryFix';
import AdminFixDuplicateGenusNumbers from './pages/AdminFixDuplicateGenusNumbers';
import AdminFixSalix from './pages/AdminFixSalix';
import AdminPlantImporter from './pages/AdminPlantImporter';
import AdminPlantNames from './pages/AdminPlantNames';
import AdminQuestCreator from './pages/AdminQuestCreator';
import Classroom from './pages/Classroom';
import Collection from './pages/Collection';
import CollectionEditor from './pages/CollectionEditor';
import Datenschutz from './pages/Datenschutz';
import DebugDiscoveries from './pages/DebugDiscoveries';
import Donate from './pages/Donate';
import Feedback from './pages/Feedback';
import FriendAchievements from './pages/FriendAchievements';
import FriendCollection from './pages/FriendCollection';
import FriendFriendsList from './pages/FriendFriendsList';
import FriendProfile from './pages/FriendProfile';
import Friends from './pages/Friends';
import GenusDetail from './pages/GenusDetail';
import Home from './pages/Home';
import Impressum from './pages/Impressum';
import KPIAdmin from './pages/KPIAdmin';
import Map from './pages/Map';
import News from './pages/News';
import NewsAdmin from './pages/NewsAdmin';
import PlantDetail from './pages/PlantDetail';
import Profile from './pages/Profile';
import QuestNotificationTemplate from './pages/QuestNotificationTemplate';
import Quests from './pages/Quests';
import ResetAccount from './pages/ResetAccount';
import ResetToLevel5 from './pages/ResetToLevel5';
import Scanner from './pages/Scanner';
import ViewSharedScan from './pages/ViewSharedScan';
import XPMigration from './pages/XPMigration';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Achievements": Achievements,
    "AdminBackup": AdminBackup,
    "AdminBlumenList": AdminBlumenList,
    "AdminCategoryFix": AdminCategoryFix,
    "AdminFixDuplicateGenusNumbers": AdminFixDuplicateGenusNumbers,
    "AdminFixSalix": AdminFixSalix,
    "AdminPlantImporter": AdminPlantImporter,
    "AdminPlantNames": AdminPlantNames,
    "AdminQuestCreator": AdminQuestCreator,
    "Classroom": Classroom,
    "Collection": Collection,
    "CollectionEditor": CollectionEditor,
    "Datenschutz": Datenschutz,
    "DebugDiscoveries": DebugDiscoveries,
    "Donate": Donate,
    "Feedback": Feedback,
    "FriendAchievements": FriendAchievements,
    "FriendCollection": FriendCollection,
    "FriendFriendsList": FriendFriendsList,
    "FriendProfile": FriendProfile,
    "Friends": Friends,
    "GenusDetail": GenusDetail,
    "Home": Home,
    "Impressum": Impressum,
    "KPIAdmin": KPIAdmin,
    "Map": Map,
    "News": News,
    "NewsAdmin": NewsAdmin,
    "PlantDetail": PlantDetail,
    "Profile": Profile,
    "QuestNotificationTemplate": QuestNotificationTemplate,
    "Quests": Quests,
    "ResetAccount": ResetAccount,
    "ResetToLevel5": ResetToLevel5,
    "Scanner": Scanner,
    "ViewSharedScan": ViewSharedScan,
    "XPMigration": XPMigration,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};