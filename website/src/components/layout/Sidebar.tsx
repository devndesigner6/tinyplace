"use client";

import {
	Bars3Icon,
	ChatBubbleOvalLeftEllipsisIcon,
	Cog6ToothIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { type ComponentType, type SVGProps, useState } from "react";
import { useTranslation } from "react-i18next";

import type { FunctionComponent } from "@src/common/types";

type Section = {
	comingSoon?: boolean;
	href?: string;
	icon?: ComponentType<SVGProps<SVGSVGElement>>;
	key: string;
	label: string;
};

type BrandIcon = (props: SVGProps<SVGSVGElement>) => FunctionComponent;

const DocumentationIcon: BrandIcon = (props) => (
	<svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		<path d="M10.802 17.77a.703.703 0 1 1-.002 1.406.703.703 0 0 1 .002-1.406m11.024-4.347a.703.703 0 1 1 .001-1.406.703.703 0 0 1-.001 1.406m0-2.876a2.176 2.176 0 0 0-2.174 2.174c0 .233.039.465.115.691l-7.181 3.823a2.165 2.165 0 0 0-1.784-.937c-.829 0-1.584.475-1.95 1.216l-6.451-3.402c-.682-.358-1.192-1.48-1.138-2.502.028-.533.212-.947.493-1.107.178-.1.392-.092.62.027l.042.023c1.71.9 7.304 3.847 7.54 3.956.363.168.565.237 1.185-.057l11.564-6.014c.17-.064.368-.227.368-.474 0-.342-.354-.477-.355-.477-.658-.315-1.669-.788-2.655-1.25-2.108-.987-4.497-2.105-5.546-2.655-.906-.474-1.635-.074-1.765.006l-.252.125C7.78 6.048 1.46 9.178 1.1 9.397.457 9.789.058 10.57.006 11.539c-.08 1.537.703 3.14 1.824 3.727l6.822 3.518a2.175 2.175 0 0 0 2.15 1.862 2.177 2.177 0 0 0 2.173-2.14l7.514-4.073c.38.298.853.461 1.337.461A2.176 2.176 0 0 0 24 12.72a2.176 2.176 0 0 0-2.174-2.174" />
	</svg>
);

const GithubIcon: BrandIcon = (props) => (
	<svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
	</svg>
);

type ExternalLink = {
	href: string;
	icon: BrandIcon;
	// A stable id used as the React key; the visible label is resolved via i18n.
	id: string;
	// The translation key for the visible label.
	labelKey: string;
};

const externalLinks: Array<ExternalLink> = [
	{
		href: "https://github.com/devndesigner6/tinyplace#readme",
		icon: DocumentationIcon,
		id: "docs",
		labelKey: "nav.docs",
	},
	{
		href: "https://github.com/devndesigner6/tinyplace",
		icon: GithubIcon,
		id: "github",
		labelKey: "nav.github",
	},
];

type SidebarProps = {
	activeSection: string;
	isDark: boolean;
	sections: Array<Section>;
};

type NavContentProps = SidebarProps & {
	onNavigate?: () => void;
};

const NavContent = ({
	activeSection,
	isDark,
	sections,
	onNavigate,
}: NavContentProps): FunctionComponent => {
	const { t } = useTranslation();
	const inactiveClasses = isDark
		? "text-neutral-500 hover:text-neutral-300"
		: "text-neutral-500 hover:text-neutral-700";

	return (
		<nav className="flex flex-1 flex-col px-2 py-2">
			{sections.map((section) => {
				const isActive = section.key === activeSection;
				const Icon = section.icon;
				return (
					<Link
						key={section.key}
						href={section.href ?? `/${section.key}`}
						className={`flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded transition-colors ${
							isActive
								? isDark
									? "text-white bg-neutral-800"
									: "text-black bg-neutral-200"
								: inactiveClasses
						} ${section.comingSoon ? "opacity-50" : ""}`}
						onClick={onNavigate}
					>
						{Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
						{section.label}
					</Link>
				);
			})}
			<div
				className={`my-2 border-t ${isDark ? "border-neutral-800" : "border-neutral-200"}`}
			/>
			{externalLinks.map((link) => {
				const Icon = link.icon;
				return (
					<a
						key={link.id}
						className={`flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded transition-colors ${inactiveClasses}`}
						href={link.href}
						rel="noreferrer"
						target="_blank"
						onClick={onNavigate}
					>
						<Icon className="h-3.5 w-3.5 shrink-0" />
						{t(link.labelKey, { defaultValue: link.labelKey })}
					</a>
				);
			})}
			<Link
				href="/feedback"
				className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
					activeSection === "feedback"
						? isDark
							? "bg-neutral-800 text-white"
							: "bg-neutral-200 text-black"
						: inactiveClasses
				}`}
				onClick={onNavigate}
			>
				<ChatBubbleOvalLeftEllipsisIcon className="h-3.5 w-3.5 shrink-0" />
				{t("nav.feedback")}
			</Link>
			<Link
				href="/settings"
				className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
					activeSection === "settings"
						? isDark
							? "bg-neutral-800 text-white"
							: "bg-neutral-200 text-black"
						: inactiveClasses
				}`}
				onClick={onNavigate}
			>
				<Cog6ToothIcon className="h-3.5 w-3.5 shrink-0" />
				{t("nav.settings")}
			</Link>
		</nav>
	);
};

export const Sidebar = ({
	activeSection,
	isDark,
	sections,
}: SidebarProps): FunctionComponent => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const openMenu = (): void => {
		setIsOpen(true);
	};
	const closeMenu = (): void => {
		setIsOpen(false);
	};

	const surfaceClasses = isDark
		? "border-neutral-800 bg-neutral-950"
		: "border-neutral-200 bg-neutral-50";
	const brandClasses = isDark ? "text-white" : "text-black";

	const brand = (
		<Link
			className={`font-heading text-sm font-bold tracking-tight ${brandClasses}`}
			href="/"
			onClick={closeMenu}
		>
			tiny.place
		</Link>
	);

	return (
		<>
			{/* Mobile: hamburger toggle (hidden on md and up) */}
			<button
				aria-label={t("nav.openMenu")}
				type="button"
				className={`md:hidden fixed left-2 top-2 z-30 p-2 rounded border transition-colors ${
					isDark
						? "border-neutral-700 bg-neutral-950 text-neutral-300"
						: "border-neutral-300 bg-neutral-50 text-neutral-700"
				}`}
				onClick={openMenu}
			>
				<Bars3Icon className="h-5 w-5" />
			</button>

			{/* Mobile: slide-in drawer + backdrop */}
			{isOpen && (
				<div className="md:hidden fixed inset-0 z-40 flex">
					<button
						aria-label={t("nav.closeMenu")}
						className="absolute inset-0 bg-black/50"
						type="button"
						onClick={closeMenu}
					/>
					<aside
						className={`relative flex w-48 flex-col min-h-screen border-r overflow-y-auto ${surfaceClasses}`}
					>
						<div
							className={`sticky top-0 z-10 flex h-[51px] items-center justify-between px-3 border-b ${surfaceClasses}`}
						>
							{brand}
							<button
								aria-label={t("nav.closeMenu")}
								className={`p-1 rounded ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-black"}`}
								type="button"
								onClick={closeMenu}
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<NavContent
							activeSection={activeSection}
							isDark={isDark}
							sections={sections}
							onNavigate={closeMenu}
						/>
					</aside>
				</div>
			)}

			{/* Desktop: static sidebar (hidden below md) */}
			<aside
				className={`hidden md:flex flex-col w-48 shrink-0 h-screen border-r overflow-y-auto ${surfaceClasses}`}
			>
				<div
					className={`sticky top-0 z-10 flex h-[51px] items-center px-3 border-b ${surfaceClasses}`}
				>
					{brand}
				</div>
				<NavContent
					activeSection={activeSection}
					isDark={isDark}
					sections={sections}
				/>
			</aside>
		</>
	);
};
