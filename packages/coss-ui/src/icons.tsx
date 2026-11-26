import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon as LucideActivityIcon,
  ArrowDownIcon as LucideArrowDownIcon,
  ArrowLeftIcon as LucideArrowLeftIcon,
  ArrowLeftRightIcon as LucideArrowLeftRightIcon,
  ArrowRightIcon as LucideArrowRightIcon,
  ArrowUpIcon as LucideArrowUpIcon,
  ArrowUpRightIcon as LucideArrowUpRightIcon,
  AsteriskIcon as LucideAsteriskIcon,
  AtomIcon as LucideAtomIcon,
  AtSignIcon as LucideAtSignIcon,
  BadgeCheckIcon as LucideBadgeCheckIcon,
  BanIcon as LucideBanIcon,
  BellIcon as LucideBellIcon,
  BikeIcon as LucideBikeIcon,
  BinaryIcon as LucideBinaryIcon,
  BlocksIcon as LucideBlocksIcon,
  BoldIcon as LucideBoldIcon,
  BookIcon as LucideBookIcon,
  BookmarkIcon as LucideBookmarkIcon,
  BookOpenCheckIcon as LucideBookOpenCheckIcon,
  BookOpenIcon as LucideBookOpenIcon,
  BookUserIcon as LucideBookUserIcon,
  BoxIcon as LucideBoxIcon,
  BuildingIcon as LucideBuildingIcon,
  CalendarCheck2Icon as LucideCalendarCheck2Icon,
  CalendarDaysIcon as LucideCalendarDaysIcon,
  CalendarHeartIcon as LucideCalendarHeartIcon,
  CalendarIcon as LucideCalendarIcon,
  CalendarRangeIcon as LucideCalendarRangeIcon,
  CalendarSearchIcon as LucideCalendarSearchIcon,
  CalendarX2Icon as LucideCalendarX2Icon,
  CaptionsIcon as LucideCaptionsIcon,
  ChartBarIcon as LucideChartBarIcon,
  ChartLineIcon as LucideChartLineIcon,
  CheckCheckIcon as LucideCheckCheckIcon,
  CheckIcon as LucideCheckIcon,
  ChevronDownIcon as LucideChevronDownIcon,
  ChevronLeftIcon as LucideChevronLeftIcon,
  ChevronRightIcon as LucideChevronRightIcon,
  ChevronsDownUpIcon as LucideChevronsDownUpIcon,
  ChevronsLeftIcon as LucideChevronsLeftIcon,
  ChevronsRightIcon as LucideChevronsRightIcon,
  ChevronsUpDownIcon as LucideChevronsUpDownIcon,
  ChevronUpIcon as LucideChevronUpIcon,
  CircleAlertIcon as LucideCircleAlertIcon,
  CircleArrowUpIcon as LucideCircleArrowUpIcon,
  CircleCheckBigIcon as LucideCircleCheckBigIcon,
  CircleCheckIcon as LucideCircleCheckIcon,
  CircleHelpIcon as LucideCircleHelpIcon,
  CircleIcon as LucideCircleIcon,
  CirclePlusIcon as LucideCirclePlusIcon,
  CircleXIcon as LucideCircleXIcon,
  ClipboardCheckIcon as LucideClipboardCheckIcon,
  ClipboardIcon as LucideClipboardIcon,
  ClockIcon as LucideClockIcon,
  CodeIcon as LucideCodeIcon,
  CodeXmlIcon as LucideCodeXmlIcon,
  Columns3Icon as LucideColumns3Icon,
  CommandIcon as LucideCommandIcon,
  CompassIcon as LucideCompassIcon,
  ContactIcon as LucideContactIcon,
  CopyIcon as LucideCopyIcon,
  CornerDownLeftIcon as LucideCornerDownLeftIcon,
  CornerDownRightIcon as LucideCornerDownRightIcon,
  CreditCardIcon as LucideCreditCardIcon,
  DiscIcon as LucideDiscIcon,
  DotIcon as LucideDotIcon,
  DownloadIcon as LucideDownloadIcon,
  EllipsisIcon as LucideEllipsisIcon,
  EllipsisVerticalIcon as LucideEllipsisVerticalIcon,
  ExternalLinkIcon as LucideExternalLinkIcon,
  EyeIcon as LucideEyeIcon,
  EyeOffIcon as LucideEyeOffIcon,
  FileDownIcon as LucideFileDownIcon,
  FileIcon as LucideFileIcon,
  FileTextIcon as LucideFileTextIcon,
  FilterIcon as LucideFilterIcon,
  FingerprintIcon as LucideFingerprintIcon,
  FlagIcon as LucideFlagIcon,
  FlaskConicalIcon as LucideFlaskConicalIcon,
  FocusIcon as LucideFocusIcon,
  FolderIcon as LucideFolderIcon,
  GiftIcon as LucideGiftIcon,
  GithubIcon as LucideGithubIcon,
  GitMergeIcon as LucideGitMergeIcon,
  GlobeIcon as LucideGlobeIcon,
  Grid3x3Icon as LucideGrid3x3Icon,
  GripVerticalIcon as LucideGripVerticalIcon,
  HandIcon as LucideHandIcon,
  HandshakeIcon as LucideHandshakeIcon,
  HeadphonesIcon as LucideHeadphonesIcon,
  HeartIcon as LucideHeartIcon,
  HistoryIcon as LucideHistoryIcon,
  HomeIcon as LucideHomeIcon,
  InfoIcon as LucideInfoIcon,
  ItalicIcon as LucideItalicIcon,
  KeyboardIcon as LucideKeyboardIcon,
  KeyIcon as LucideKeyIcon,
  LayersIcon as LucideLayersIcon,
  LayoutDashboardIcon as LucideLayoutDashboardIcon,
  Link2Icon as LucideLink2Icon,
  LinkIcon as LucideLinkIcon,
  ListFilterIcon as LucideListFilterIcon,
  LoaderIcon as LucideLoaderIcon,
  LockIcon as LucideLockIcon,
  LockOpenIcon as LucideLockOpenIcon,
  LogOutIcon as LucideLogOutIcon,
  MailIcon as LucideMailIcon,
  MailOpenIcon as LucideMailOpenIcon,
  MapIcon as LucideMapIcon,
  MapPinIcon as LucideMapPinIcon,
  Maximize2Icon as LucideMaximize2Icon,
  MenuIcon as LucideMenuIcon,
  MessageCircleIcon as LucideMessageCircleIcon,
  MessageSquareShareIcon as LucideMessageSquareShareIcon,
  MessagesSquareIcon as LucideMessagesSquareIcon,
  MicIcon as LucideMicIcon,
  MicOffIcon as LucideMicOffIcon,
  Minimize2Icon as LucideMinimize2Icon,
  MinusIcon as LucideMinusIcon,
  MonitorIcon as LucideMonitorIcon,
  MonitorOffIcon as LucideMonitorOffIcon,
  MoonIcon as LucideMoonIcon,
  MousePointer2Icon as LucideMousePointer2Icon,
  MusicIcon as LucideMusicIcon,
  PaintbrushIcon as LucidePaintbrushIcon,
  PaletteIcon as LucidePaletteIcon,
  PanelRightIcon as LucidePanelRightIcon,
  PanelRightOpenIcon as LucidePanelRightOpenIcon,
  PaperclipIcon as LucidePaperclipIcon,
  PauseIcon as LucidePauseIcon,
  PawPrintIcon as LucidePawPrintIcon,
  PencilIcon as LucidePencilIcon,
  PhoneCallIcon as LucidePhoneCallIcon,
  PhoneIcon as LucidePhoneIcon,
  PhoneIncomingIcon as LucidePhoneIncomingIcon,
  PhoneOffIcon as LucidePhoneOffIcon,
  PhoneOutgoingIcon as LucidePhoneOutgoingIcon,
  PictureInPicture2Icon as LucidePictureInPicture2Icon,
  PinIcon as LucidePinIcon,
  PinOffIcon as LucidePinOffIcon,
  PlayIcon as LucidePlayIcon,
  PlusIcon as LucidePlusIcon,
  ReceiptIcon as LucideReceiptIcon,
  RefreshCcwIcon as LucideRefreshCcwIcon,
  RefreshCwIcon as LucideRefreshCwIcon,
  RepeatIcon as LucideRepeatIcon,
  RocketIcon as LucideRocketIcon,
  RotateCcwIcon as LucideRotateCcwIcon,
  RotateCwIcon as LucideRotateCwIcon,
  ScanLineIcon as LucideScanLineIcon,
  SearchIcon as LucideSearchIcon,
  SendIcon as LucideSendIcon,
  SettingsIcon as LucideSettingsIcon,
  ShareIcon as LucideShareIcon,
  ShieldCheckIcon as LucideShieldCheckIcon,
  ShieldIcon as LucideShieldIcon,
  ShuffleIcon as LucideShuffleIcon,
  SlidersHorizontalIcon as LucideSlidersHorizontalIcon,
  SlidersVerticalIcon as LucideSlidersVerticalIcon,
  SmartphoneIcon as LucideSmartphoneIcon,
  SmilePlusIcon as LucideSmilePlusIcon,
  SparklesIcon as LucideSparklesIcon,
  SplitIcon as LucideSplitIcon,
  SquareCheckIcon as LucideSquareCheckIcon,
  SquareDashedBottomIcon as LucideSquareDashedBottomIcon,
  SquareIcon as LucideSquareIcon,
  SquarePenIcon as LucideSquarePenIcon,
  SquareRoundCornerIcon as LucideSquareRoundCornerIcon,
  StarIcon as LucideStarIcon,
  StethoscopeIcon as LucideStethoscopeIcon,
  SunIcon as LucideSunIcon,
  SunriseIcon as LucideSunriseIcon,
  SunsetIcon as LucideSunsetIcon,
  TagsIcon as LucideTagsIcon,
  TerminalIcon as LucideTerminalIcon,
  ThumbsDownIcon as LucideThumbsDownIcon,
  ThumbsUpIcon as LucideThumbsUpIcon,
  TicketIcon as LucideTicketIcon,
  Trash2Icon as LucideTrash2Icon,
  TrashIcon as LucideTrashIcon,
  TriangleAlertIcon as LucideTriangleAlertIcon,
  UploadIcon as LucideUploadIcon,
  UserCheckIcon as LucideUserCheckIcon,
  UserIcon as LucideUserIcon,
  UserMinusIcon as LucideUserMinusIcon,
  UserPlusIcon as LucideUserPlusIcon,
  UsersIcon as LucideUsersIcon,
  UserXIcon as LucideUserXIcon,
  VenetianMaskIcon as LucideVenetianMaskIcon,
  VideoIcon as LucideVideoIcon,
  VideoOffIcon as LucideVideoOffIcon,
  Volume2Icon as LucideVolume2Icon,
  WaypointsIcon as LucideWaypointsIcon,
  WebhookIcon as LucideWebhookIcon,
  WifiOffIcon as LucideWifiOffIcon,
  XIcon as LucideXIcon,
  ZapIcon as LucideZapIcon,
} from "lucide-react";

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
  "data-testid"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-current"?: React.AriaAttributes["aria-current"];
}

export type IconComponent = React.ComponentType<IconProps>;

function createIcon(Icon: LucideIcon, defaultTestId: string) {
  return function WrappedIcon({
    size = 16,
    strokeWidth,
    className,
    onClick,
    "data-testid": dataTestId,
    "aria-hidden": ariaHidden,
    "aria-current": ariaCurrent,
  }: IconProps) {
    return (
      <Icon
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        onClick={onClick}
        aria-hidden={ariaHidden}
        aria-current={ariaCurrent}
        data-testid={dataTestId ?? defaultTestId}
      />
    );
  };
}

export const ActivityIcon = createIcon(LucideActivityIcon, "activity-icon");
export const ArrowDownIcon = createIcon(LucideArrowDownIcon, "arrow-down-icon");
export const ArrowLeftIcon = createIcon(LucideArrowLeftIcon, "arrow-left-icon");
export const ArrowLeftRightIcon = createIcon(LucideArrowLeftRightIcon, "arrow-left-right-icon");
export const ArrowRightIcon = createIcon(LucideArrowRightIcon, "arrow-right-icon");
export const ArrowUpRightIcon = createIcon(LucideArrowUpRightIcon, "arrow-up-right-icon");
export const ArrowUpIcon = createIcon(LucideArrowUpIcon, "arrow-up-icon");
export const AsteriskIcon = createIcon(LucideAsteriskIcon, "asterisk-icon");
export const AtSignIcon = createIcon(LucideAtSignIcon, "at-sign-icon");
export const AtomIcon = createIcon(LucideAtomIcon, "atom-icon");
export const BadgeCheckIcon = createIcon(LucideBadgeCheckIcon, "badge-check-icon");
export const BanIcon = createIcon(LucideBanIcon, "ban-icon");
export const BellIcon = createIcon(LucideBellIcon, "bell-icon");
export const BikeIcon = createIcon(LucideBikeIcon, "bike-icon");
export const BinaryIcon = createIcon(LucideBinaryIcon, "binary-icon");
export const BlocksIcon = createIcon(LucideBlocksIcon, "blocks-icon");
export const BoldIcon = createIcon(LucideBoldIcon, "bold-icon");
export const BookOpenCheckIcon = createIcon(LucideBookOpenCheckIcon, "book-open-check-icon");
export const BookOpenIcon = createIcon(LucideBookOpenIcon, "book-open-icon");
export const BookUserIcon = createIcon(LucideBookUserIcon, "book-user-icon");
export const BookIcon = createIcon(LucideBookIcon, "book-icon");
export const BookmarkIcon = createIcon(LucideBookmarkIcon, "bookmark-icon");
export const BoxIcon = createIcon(LucideBoxIcon, "box-icon");
export const BuildingIcon = createIcon(LucideBuildingIcon, "building-icon");
export const CalendarCheck2Icon = createIcon(LucideCalendarCheck2Icon, "calendar-check-2-icon");
export const CalendarDaysIcon = createIcon(LucideCalendarDaysIcon, "calendar-days-icon");
export const CaptionsIcon = createIcon(LucideCaptionsIcon, "captions-icon");
export const CalendarHeartIcon = createIcon(LucideCalendarHeartIcon, "calendar-heart-icon");
export const HeadphonesIcon = createIcon(LucideHeadphonesIcon, "headphones-icon");
export const HeartIcon = createIcon(LucideHeartIcon, "heart-icon");
export const CalendarRangeIcon = createIcon(LucideCalendarRangeIcon, "calendar-range-icon");
export const CalendarSearchIcon = createIcon(LucideCalendarSearchIcon, "calendar-search-icon");
export const CalendarX2Icon = createIcon(LucideCalendarX2Icon, "calendar-x-2-icon");
export const CalendarIcon = createIcon(LucideCalendarIcon, "calendar-icon");
export const ChartBarIcon = createIcon(LucideChartBarIcon, "chart-bar-icon");
export const ChartLineIcon = createIcon(LucideChartLineIcon, "chart-line-icon");
export const CheckCheckIcon = createIcon(LucideCheckCheckIcon, "check-check-icon");
export const CheckIcon = createIcon(LucideCheckIcon, "check-icon");
export const ChevronDownIcon = createIcon(LucideChevronDownIcon, "chevron-down-icon");
export const ChevronLeftIcon = createIcon(LucideChevronLeftIcon, "chevron-left-icon");
export const ChevronRightIcon = createIcon(LucideChevronRightIcon, "chevron-right-icon");
export const ChevronUpIcon = createIcon(LucideChevronUpIcon, "chevron-up-icon");
export const ChevronsDownUpIcon = createIcon(LucideChevronsDownUpIcon, "chevrons-down-up-icon");
export const ChevronsLeftIcon = createIcon(LucideChevronsLeftIcon, "chevrons-left-icon");
export const ChevronsRightIcon = createIcon(LucideChevronsRightIcon, "chevrons-right-icon");
export const ChevronsUpDownIcon = createIcon(LucideChevronsUpDownIcon, "chevrons-up-down-icon");
export const CircleAlertIcon = createIcon(LucideCircleAlertIcon, "circle-alert-icon");
export const CircleArrowUpIcon = createIcon(LucideCircleArrowUpIcon, "circle-arrow-up-icon");
export const CircleCheckBigIcon = createIcon(LucideCircleCheckBigIcon, "circle-check-big-icon");
export const CircleCheckIcon = createIcon(LucideCircleCheckIcon, "circle-check-icon");
export const CircleHelpIcon = createIcon(LucideCircleHelpIcon, "circle-help-icon");
export const CirclePlusIcon = createIcon(LucideCirclePlusIcon, "circle-plus-icon");
export const CircleXIcon = createIcon(LucideCircleXIcon, "circle-x-icon");
export const CircleIcon = createIcon(LucideCircleIcon, "circle-icon");
export const ClipboardCheckIcon = createIcon(LucideClipboardCheckIcon, "clipboard-check-icon");
export const ClipboardIcon = createIcon(LucideClipboardIcon, "clipboard-icon");
export const ClockIcon = createIcon(LucideClockIcon, "clock-icon");
export const CodeIcon = createIcon(LucideCodeIcon, "code-icon");
export const CodeXmlIcon = createIcon(LucideCodeXmlIcon, "code-xml-icon");
export const Columns3Icon = createIcon(LucideColumns3Icon, "columns-3-icon");
export const CommandIcon = createIcon(LucideCommandIcon, "command-icon");
export const CompassIcon = createIcon(LucideCompassIcon, "compass-icon");
export const ContactIcon = createIcon(LucideContactIcon, "contact-icon");
export const CopyIcon = createIcon(LucideCopyIcon, "copy-icon");
export const CornerDownLeftIcon = createIcon(LucideCornerDownLeftIcon, "corner-down-left-icon");
export const CornerDownRightIcon = createIcon(LucideCornerDownRightIcon, "corner-down-right-icon");
export const CreditCardIcon = createIcon(LucideCreditCardIcon, "credit-card-icon");
export const KeyboardIcon = createIcon(LucideKeyboardIcon, "keyboard-icon");
export const PaletteIcon = createIcon(LucidePaletteIcon, "palette-icon");
export const ReceiptIcon = createIcon(LucideReceiptIcon, "receipt-icon");
export const DiscIcon = createIcon(LucideDiscIcon, "disc-icon");
export const DotIcon = createIcon(LucideDotIcon, "dot-icon");
export const DownloadIcon = createIcon(LucideDownloadIcon, "download-icon");
export const EllipsisVerticalIcon = createIcon(LucideEllipsisVerticalIcon, "ellipsis-vertical-icon");
export const EllipsisIcon = createIcon(LucideEllipsisIcon, "ellipsis-icon");
export const ExternalLinkIcon = createIcon(LucideExternalLinkIcon, "external-link-icon");
export const EyeOffIcon = createIcon(LucideEyeOffIcon, "eye-off-icon");
export const EyeIcon = createIcon(LucideEyeIcon, "eye-icon");
export const FileDownIcon = createIcon(LucideFileDownIcon, "file-down-icon");
export const FileTextIcon = createIcon(LucideFileTextIcon, "file-text-icon");
export const FileIcon = createIcon(LucideFileIcon, "file-icon");
export const FilterIcon = createIcon(LucideFilterIcon, "filter-icon");
export const FingerprintIcon = createIcon(LucideFingerprintIcon, "fingerprint-icon");
export const FlagIcon = createIcon(LucideFlagIcon, "flag-icon");
export const FlaskConicalIcon = createIcon(LucideFlaskConicalIcon, "flask-conical-icon");
export const FocusIcon = createIcon(LucideFocusIcon, "focus-icon");
export const FolderIcon = createIcon(LucideFolderIcon, "folder-icon");
export const GiftIcon = createIcon(LucideGiftIcon, "gift-icon");
export const GitMergeIcon = createIcon(LucideGitMergeIcon, "git-merge-icon");
export const GithubIcon = createIcon(LucideGithubIcon, "github-icon");
export const GlobeIcon = createIcon(LucideGlobeIcon, "globe-icon");
export const GripVerticalIcon = createIcon(LucideGripVerticalIcon, "grip-vertical-icon");
export const HomeIcon = createIcon(LucideHomeIcon, "home-icon");
export const Grid3x3Icon = createIcon(LucideGrid3x3Icon, "grid-3x3-icon");
export const HandIcon = createIcon(LucideHandIcon, "hand-icon");
export const HandshakeIcon = createIcon(LucideHandshakeIcon, "handshake-icon");
export const HistoryIcon = createIcon(LucideHistoryIcon, "history-icon");
export const InfoIcon = createIcon(LucideInfoIcon, "info-icon");
export const ItalicIcon = createIcon(LucideItalicIcon, "italic-icon");
export const KeyIcon = createIcon(LucideKeyIcon, "key-icon");
export const LayersIcon = createIcon(LucideLayersIcon, "layers-icon");
export const LayoutDashboardIcon = createIcon(LucideLayoutDashboardIcon, "layout-dashboard-icon");
export const Link2Icon = createIcon(LucideLink2Icon, "link-2-icon");
export const LinkIcon = createIcon(LucideLinkIcon, "link-icon");
export const ListFilterIcon = createIcon(LucideListFilterIcon, "list-filter-icon");
export const LoaderIcon = createIcon(LucideLoaderIcon, "loader-icon");
export const LockOpenIcon = createIcon(LucideLockOpenIcon, "lock-open-icon");
export const LockIcon = createIcon(LucideLockIcon, "lock-icon");
export const LogOutIcon = createIcon(LucideLogOutIcon, "log-out-icon");
export const MailOpenIcon = createIcon(LucideMailOpenIcon, "mail-open-icon");
export const MailIcon = createIcon(LucideMailIcon, "mail-icon");
export const MapPinIcon = createIcon(LucideMapPinIcon, "map-pin-icon");
export const MapIcon = createIcon(LucideMapIcon, "map-icon");
export const Maximize2Icon = createIcon(LucideMaximize2Icon, "maximize-2-icon");
export const MenuIcon = createIcon(LucideMenuIcon, "menu-icon");
export const MessageCircleIcon = createIcon(LucideMessageCircleIcon, "message-circle-icon");
export const MessageSquareShareIcon = createIcon(LucideMessageSquareShareIcon, "message-square-share-icon");
export const MessagesSquareIcon = createIcon(LucideMessagesSquareIcon, "messages-square-icon");
export const MicOffIcon = createIcon(LucideMicOffIcon, "mic-off-icon");
export const MicIcon = createIcon(LucideMicIcon, "mic-icon");
export const Minimize2Icon = createIcon(LucideMinimize2Icon, "minimize-2-icon");
export const MinusIcon = createIcon(LucideMinusIcon, "minus-icon");
export const MonitorIcon = createIcon(LucideMonitorIcon, "monitor-icon");
export const MonitorOffIcon = createIcon(LucideMonitorOffIcon, "monitor-off-icon");
export const MoonIcon = createIcon(LucideMoonIcon, "moon-icon");
export const MousePointer2Icon = createIcon(LucideMousePointer2Icon, "mouse-pointer-2-icon");
export const MusicIcon = createIcon(LucideMusicIcon, "music-icon");
export const PaintbrushIcon = createIcon(LucidePaintbrushIcon, "paintbrush-icon");
export const PaperclipIcon = createIcon(LucidePaperclipIcon, "paperclip-icon");
export const PanelRightIcon = createIcon(LucidePanelRightIcon, "panel-right-icon");
export const PanelRightOpenIcon = createIcon(LucidePanelRightOpenIcon, "panel-right-open-icon");
export const PauseIcon = createIcon(LucidePauseIcon, "pause-icon");
export const PawPrintIcon = createIcon(LucidePawPrintIcon, "paw-print-icon");
export const PencilIcon = createIcon(LucidePencilIcon, "pencil-icon");
export const PhoneCallIcon = createIcon(LucidePhoneCallIcon, "phone-call-icon");
export const PhoneIncomingIcon = createIcon(LucidePhoneIncomingIcon, "phone-incoming-icon");
export const PhoneOffIcon = createIcon(LucidePhoneOffIcon, "phone-off-icon");
export const PhoneOutgoingIcon = createIcon(LucidePhoneOutgoingIcon, "phone-outgoing-icon");
export const PhoneIcon = createIcon(LucidePhoneIcon, "phone-icon");
export const PinIcon = createIcon(LucidePinIcon, "pin-icon");
export const PinOffIcon = createIcon(LucidePinOffIcon, "pin-off-icon");
export const PictureInPicture2Icon = createIcon(LucidePictureInPicture2Icon, "picture-in-picture-2-icon");
export const PlayIcon = createIcon(LucidePlayIcon, "play-icon");
export const PlusIcon = createIcon(LucidePlusIcon, "plus-icon");
export const RefreshCcwIcon = createIcon(LucideRefreshCcwIcon, "refresh-ccw-icon");
export const RefreshCwIcon = createIcon(LucideRefreshCwIcon, "refresh-cw-icon");
export const RepeatIcon = createIcon(LucideRepeatIcon, "repeat-icon");
export const RocketIcon = createIcon(LucideRocketIcon, "rocket-icon");
export const RotateCcwIcon = createIcon(LucideRotateCcwIcon, "rotate-ccw-icon");
export const RotateCwIcon = createIcon(LucideRotateCwIcon, "rotate-cw-icon");
export const ScanLineIcon = createIcon(LucideScanLineIcon, "scan-line-icon");
export const SearchIcon = createIcon(LucideSearchIcon, "search-icon");
export const SendIcon = createIcon(LucideSendIcon, "send-icon");
export const SettingsIcon = createIcon(LucideSettingsIcon, "settings-icon");
export const ShareIcon = createIcon(LucideShareIcon, "share-icon");
export const ShieldCheckIcon = createIcon(LucideShieldCheckIcon, "shield-check-icon");
export const ShieldIcon = createIcon(LucideShieldIcon, "shield-icon");
export const ShuffleIcon = createIcon(LucideShuffleIcon, "shuffle-icon");
export const SlidersHorizontalIcon = createIcon(LucideSlidersHorizontalIcon, "sliders-horizontal-icon");
export const SlidersVerticalIcon = createIcon(LucideSlidersVerticalIcon, "sliders-vertical-icon");
export const SmartphoneIcon = createIcon(LucideSmartphoneIcon, "smartphone-icon");
export const SmilePlusIcon = createIcon(LucideSmilePlusIcon, "smile-plus-icon");
export const SparklesIcon = createIcon(LucideSparklesIcon, "sparkles-icon");
export const SplitIcon = createIcon(LucideSplitIcon, "split-icon");
export const SquareIcon = createIcon(LucideSquareIcon, "square-icon");
export const SquareCheckIcon = createIcon(LucideSquareCheckIcon, "square-check-icon");
export const SquareDashedBottomIcon = createIcon(LucideSquareDashedBottomIcon, "square-dashed-bottom-icon");
export const SquarePenIcon = createIcon(LucideSquarePenIcon, "square-pen-icon");
export const SquareRoundCornerIcon = createIcon(LucideSquareRoundCornerIcon, "square-round-corner-icon");
export const StarIcon = createIcon(LucideStarIcon, "star-icon");
export const StethoscopeIcon = createIcon(LucideStethoscopeIcon, "stethoscope-icon");
export const SunIcon = createIcon(LucideSunIcon, "sun-icon");
export const SunriseIcon = createIcon(LucideSunriseIcon, "sunrise-icon");
export const SunsetIcon = createIcon(LucideSunsetIcon, "sunset-icon");
export const TagsIcon = createIcon(LucideTagsIcon, "tags-icon");
export const TerminalIcon = createIcon(LucideTerminalIcon, "terminal-icon");
export const ThumbsDownIcon = createIcon(LucideThumbsDownIcon, "thumbs-down-icon");
export const ThumbsUpIcon = createIcon(LucideThumbsUpIcon, "thumbs-up-icon");
export const TicketIcon = createIcon(LucideTicketIcon, "ticket-icon");
export const Trash2Icon = createIcon(LucideTrash2Icon, "trash-2-icon");
export const TrashIcon = createIcon(LucideTrashIcon, "trash-icon");
export const TriangleAlertIcon = createIcon(LucideTriangleAlertIcon, "triangle-alert-icon");
export const UploadIcon = createIcon(LucideUploadIcon, "upload-icon");
export const UserCheckIcon = createIcon(LucideUserCheckIcon, "user-check-icon");
export const UserMinusIcon = createIcon(LucideUserMinusIcon, "user-minus-icon");
export const UserPlusIcon = createIcon(LucideUserPlusIcon, "user-plus-icon");
export const UserXIcon = createIcon(LucideUserXIcon, "user-x-icon");
export const UserIcon = createIcon(LucideUserIcon, "user-icon");
export const UsersIcon = createIcon(LucideUsersIcon, "users-icon");
export const VenetianMaskIcon = createIcon(LucideVenetianMaskIcon, "venetian-mask-icon");
export const VideoIcon = createIcon(LucideVideoIcon, "video-icon");
export const VideoOffIcon = createIcon(LucideVideoOffIcon, "video-off-icon");
export const Volume2Icon = createIcon(LucideVolume2Icon, "volume-2-icon");
export const WaypointsIcon = createIcon(LucideWaypointsIcon, "waypoints-icon");
export const WebhookIcon = createIcon(LucideWebhookIcon, "webhook-icon");
export const WifiOffIcon = createIcon(LucideWifiOffIcon, "wifi-off-icon");
export const XIcon = createIcon(LucideXIcon, "x-icon");
export const ZapIcon = createIcon(LucideZapIcon, "zap-icon");
