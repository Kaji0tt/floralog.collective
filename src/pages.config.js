import Achievements from './pages/Achievements';
import AdminBlumenList from './pages/AdminBlumenList';
import AdminCategoryFix from './pages/AdminCategoryFix';
import AdminFixDuplicateGenusNumbers from './pages/AdminFixDuplicateGenusNumbers';
import AdminFixSalix from './pages/AdminFixSalix';
import AdminPlantImporter from './pages/AdminPlantImporter';
import AdminPlantNames from './pages/AdminPlantNames';
import AdminQuestCreator from './pages/AdminQuestCreator';
import Classroom from './pages/Classroom';
import Collection from './pages/Collection';
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
import Map from './pages/Map';
import MigrateDiscoveries from './pages/MigrateDiscoveries';
import MigratePlantGenus from './pages/MigratePlantGenus';
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
    "AdminBlumenList": AdminBlumenList,
    "AdminCategoryFix": AdminCategoryFix,
    "AdminFixDuplicateGenusNumbers": AdminFixDuplicateGenusNumbers,
    "AdminFixSalix": AdminFixSalix,
    "AdminPlantImporter": AdminPlantImporter,
    "AdminPlantNames": AdminPlantNames,
    "AdminQuestCreator": AdminQuestCreator,
    "Classroom": Classroom,
    "Collection": Collection,
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
    "Map": Map,
    "MigrateDiscoveries": MigrateDiscoveries,
    "MigratePlantGenus": MigratePlantGenus,
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