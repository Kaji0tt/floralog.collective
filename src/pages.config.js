import Scanner from './pages/Scanner';
import Collection from './pages/Collection';
import PlantDetail from './pages/PlantDetail';
import Home from './pages/Home';
import Map from './pages/Map';
import GenusDetail from './pages/GenusDetail';
import Profile from './pages/Profile';
import Classroom from './pages/Classroom';
import Donate from './pages/Donate';
import AdminPlantImporter from './pages/AdminPlantImporter';
import Achievements from './pages/Achievements';
import Friends from './pages/Friends';
import Impressum from './pages/Impressum';
import FriendCollection from './pages/FriendCollection';
import Quests from './pages/Quests';
import XPMigration from './pages/XPMigration';
import ResetToLevel5 from './pages/ResetToLevel5';
import AdminPlantNames from './pages/AdminPlantNames';
import AdminCategoryFix from './pages/AdminCategoryFix';
import FriendProfile from './pages/FriendProfile';
import Feedback from './pages/Feedback';
import Datenschutz from './pages/Datenschutz';
import ResetAccount from './pages/ResetAccount';
import AdminFixSalix from './pages/AdminFixSalix';
import DebugDiscoveries from './pages/DebugDiscoveries';
import MigrateDiscoveries from './pages/MigrateDiscoveries';
import FriendAchievements from './pages/FriendAchievements';
import AdminBlumenList from './pages/AdminBlumenList';
import FriendFriendsList from './pages/FriendFriendsList';
import ViewSharedScan from './pages/ViewSharedScan';
import Layout from './Layout.jsx';


export const PAGES = {
    "Scanner": Scanner,
    "Collection": Collection,
    "PlantDetail": PlantDetail,
    "Home": Home,
    "Map": Map,
    "GenusDetail": GenusDetail,
    "Profile": Profile,
    "Classroom": Classroom,
    "Donate": Donate,
    "AdminPlantImporter": AdminPlantImporter,
    "Achievements": Achievements,
    "Friends": Friends,
    "Impressum": Impressum,
    "FriendCollection": FriendCollection,
    "Quests": Quests,
    "XPMigration": XPMigration,
    "ResetToLevel5": ResetToLevel5,
    "AdminPlantNames": AdminPlantNames,
    "AdminCategoryFix": AdminCategoryFix,
    "FriendProfile": FriendProfile,
    "Feedback": Feedback,
    "Datenschutz": Datenschutz,
    "ResetAccount": ResetAccount,
    "AdminFixSalix": AdminFixSalix,
    "DebugDiscoveries": DebugDiscoveries,
    "MigrateDiscoveries": MigrateDiscoveries,
    "FriendAchievements": FriendAchievements,
    "AdminBlumenList": AdminBlumenList,
    "FriendFriendsList": FriendFriendsList,
    "ViewSharedScan": ViewSharedScan,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};