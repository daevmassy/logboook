import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, Filter, LogOut, Menu, MessageSquareText,
  Plus, Search, ShieldCheck, Users, X, CalendarDays, ClipboardList, Pencil, Printer,
  Trash2, UserRound, LockKeyhole, LoaderCircle, RefreshCw,
} from 'lucide-react';
import {
  useGetMyProfile, useSaveMyProfile, useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  useAddTaskComment, useListMembers, useUpdateMemberRole, useGetWeeklyReport,
  getGetMyProfileQueryKey, getListTasksQueryKey, getListMembersQueryKey, getGetWeeklyReportQueryKey,
} from '@workspace/api-client-react';
import type { Member, ProfileInput, Task, TaskInput, TaskUpdate, WeeklyReport } from '@workspace/api-client-react';
import { buildWeeklyReportDocx } from './weekly-report-docx';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#326c65', colorForeground: '#253538', colorMutedForeground: '#6c7776', colorDanger: '#ae5147',
    colorBackground: '#fcfbf7', colorInput: '#fcfbf7', colorInputForeground: '#253538', colorNeutral: '#d8d7ce',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fcfbf7] rounded-2xl w-[380px] max-w-full min-[1200px]:w-[440px] overflow-hidden border border-[#dedbd1]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#253538] font-bold', headerSubtitle: 'text-[#687573]', socialButtonsBlockButtonText: 'text-[#253538]',
    formFieldLabel: 'text-[#344341]', footerActionLink: 'text-[#326c65] font-semibold', footerActionText: 'text-[#687573]',
    dividerText: 'text-[#687573]', identityPreviewEditButton: 'text-[#326c65]', formFieldSuccessText: 'text-[#326c65]',
    alertText: 'text-[#9f443d]', logoBox: 'rounded-lg', logoImage: 'object-contain', socialButtonsBlockButton: 'border-[#d8d7ce]',
    formButtonPrimary: 'bg-[#326c65] hover:bg-[#285a54] text-white', formFieldInput: 'border-[#d8d7ce] bg-[#fcfbf7]',
    footerAction: 'border-t border-[#e2dfd5]', dividerLine: 'bg-[#d8d7ce]', alert: 'bg-[#fff1ed]',
    otpCodeFieldInput: 'border-[#d8d7ce]', formFieldRow: 'gap-2', main: 'gap-5',
  },
};

function Logo({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return <span className={`brand-lockup ${inverse ? 'inverse' : ''}`}><span className="brand-mark"><ClipboardList size={18} strokeWidth={2.2} /></span>{!compact && <span className="brand-name">daybook<span>.</span></span>}</span>;
}
function Button({ children, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return <button className={`btn btn-${variant}`} {...props}>{children}</button>;
}
function SkeletonLines({ count = 4 }: { count?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><div className="skeleton" style={{ height: 18, width: '28%' }} />{Array.from({ length: count }, (_, i) => <div key={i} className="skeleton" style={{ height: 54, width: `${98 - (i % 2) * 8}%` }} />)}</div>;
}
function QueryError({ message = 'We couldn’t load this view.', retry }: { message?: string; retry: () => void }) {
  return <div className="state-card" role="alert"><span className="state-icon"><CircleHelp size={21} /></span><strong>Something interrupted the handoff.</strong><p>{message}</p><Button variant="secondary" onClick={retry} data-testid="button-retry"><RefreshCw size={15} /> Try again</Button></div>;
}
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-stamp"><FileText size={22} /></span><strong>{title}</strong><p>{detail}</p>{action}</div>;
}
function Avatar({ name, size = 'normal' }: { name: string; size?: 'normal' | 'small' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';
  return <span className={`avatar ${size === 'small' ? 'avatar-small' : ''}`} aria-label={name}>{initials}</span>;
}
function getError(error: unknown) { return error instanceof Error ? error.message : 'Please check your connection and try again.'; }
function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', options).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}
function todayISO() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function mondayOf(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function initialsName(member: Member) { return `${member.firstName} ${member.lastName}`.trim() || member.username || member.email; }

function Home() {
  return <main className="landing grain">
    <header className="landing-nav"><Link href="/" className="brand-link" data-testid="link-home"><Logo /></Link><div className="landing-nav-actions"><a href="#how-it-works" className="landing-text-link" data-testid="link-how-it-works">How it works</a><Link href="/sign-in" className="landing-text-link" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="btn btn-primary" data-testid="link-sign-up">Create your account <ArrowUpRight size={15} /></Link></div></header>
    <section className="hero-wrap">
      <div className="hero-copy rise"><div className="eyebrow"><span className="eyebrow-dot" />A clearer record of the workday</div><h1>Good work<br />shouldn’t get <em>lost.</em></h1>
        <p className="hero-lede">A dependable daily journal for the work that moves your team forward. Capture the details, share progress, and make every week easier to understand.</p>
        <div className="hero-actions"><Link href="/sign-up" className="btn btn-primary hero-cta" data-testid="link-start-journaling">Start your work journal <ArrowRight size={17} /></Link><span className="hero-note">Built for real workdays, not status theater.</span></div>
      </div>
      <div className="hero-art rise">
        <div className="art-topline"><span>WEDNESDAY, OCTOBER 16</span><span className="art-live"><i /> IN THE FLOW</span></div>
        <div className="art-sheet">
          <div className="sheet-head"><div><span className="sheet-label">TODAY’S LOG</span><h2>Progress, in context.</h2></div><span className="sheet-date">08:42 <Clock3 size={13} /></span></div>
          <div className="sheet-entry"><div className="entry-marker done"><Check size={14} /></div><div className="entry-body"><span className="entry-time">09:15 · OPERATIONS</span><strong>Reconciled the Northline inventory</strong><p>Matched 38 supplier records and flagged two items for follow-up.</p></div><span className="entry-tag">COMPLETE</span></div>
          <div className="sheet-entry"><div className="entry-marker"><span /></div><div className="entry-body"><span className="entry-time">11:30 · CUSTOMER CARE</span><strong>Reviewed open service escalations</strong><p>Three accounts need a response before end of day.</p></div><span className="entry-tag pending-tag">IN PROGRESS</span></div>
          <div className="sheet-foot"><span><MessageSquareText size={14} /> One supervisor note</span><span>2 entries <ArrowRight size={13} /></span></div>
        </div>
        <div className="art-note"><span className="note-pip" /><span>DETAILS THAT ADD UP</span><div>Every entry has a date,<br />an owner, and a next step.</div></div>
        <div className="art-grid" />
      </div>
    </section>
    <div className="landing-rule"><span>ONE WORKDAY AT A TIME</span><span className="rule-line" /><span>MADE FOR TEAMS WHO FOLLOW THROUGH</span></div>
    <section id="how-it-works" className="landing-story">
      <div className="story-heading"><span className="eyebrow">A simpler operating rhythm</span><h2>Make the work<br />visible. Keep it <em>moving.</em></h2></div>
      <div className="story-points">
        <article><span className="story-num">01</span><div><h3>Capture the shift</h3><p>Log what happened, when it happened, and what comes next. A useful record takes a minute—not a meeting.</p></div></article>
        <article><span className="story-num">02</span><div><h3>Review with context</h3><p>Supervisors see the week take shape, with room to ask a question or recognize a thoughtful handoff.</p></div></article>
        <article><span className="story-num">03</span><div><h3>Close the loop</h3><p>Clear ownership and a shared history turn scattered updates into steady, accountable progress.</p></div></article>
      </div>
    </section>
    <section className="landing-band"><div className="band-mark"><Activity size={23} /></div><div><span>THE SMALL THINGS ARE THE WORK</span><h2>Better notes. Better handoffs.<br />A better read on the week.</h2></div><Link href="/sign-up" className="btn band-button" data-testid="link-build-record">Build your team’s record <ArrowRight size={16} /></Link></section>
    <footer className="landing-footer"><Link href="/" className="brand-link"><Logo /></Link><span>A thoughtful record of the work that matters.</span><Link href="/sign-in" className="landing-text-link" data-testid="link-footer-sign-in">Sign in <ArrowUpRight size={13} /></Link></footer>
  </main>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Redirect to="/sign-up" /></Show></>;
}
function AdminLogoButton({ inverse = false }: { inverse?: boolean }) {
  const [, setLocation] = useLocation();
  const lastTapAt = useRef(0);
  function openSupervisorSignIn() {
    const now = Date.now();
    if (now - lastTapAt.current <= 450) {
      lastTapAt.current = 0;
      setLocation('/admin/sign-in');
      return;
    }
    lastTapAt.current = now;
  }
  return <button type="button" className="brand-link admin-access-logo" onClick={openSupervisorSignIn}
    aria-label="Daybook. Double-tap for supervisor sign-in." title="Double-tap for supervisor sign-in">
    <Logo inverse={inverse} />
  </button>;
}
function AuthRoute({ mode, adminLogin = false }: { mode: 'in' | 'up'; adminLogin?: boolean }) {
  const signInPath = adminLogin ? `${basePath}/admin/sign-in` : `${basePath}/sign-in`;
  const signUpPath = `${basePath}/sign-up`;
  return <main className="auth-page">
    <div className="auth-aside"><AdminLogoButton inverse /><div className="auth-quote"><span>THE DAILY RECORD</span><h1>Make every<br />day’s work <em>count.</em></h1><p>A practical journal for focused teams and the people who help them do their best work.</p></div><div className="auth-aside-foot">DAYBOOK · WORK, WELL ACCOUNTED FOR</div></div>
    <div className="auth-form-side"><div className="auth-mobile-brand"><AdminLogoButton /></div>
      {mode === 'in'
        ? <SignIn routing="path" path={signInPath} signUpUrl={signUpPath} {...(adminLogin ? { forceRedirectUrl: `${basePath}/admin` } : {})} />
        : <SignUp routing="path" path={signUpPath} signInUrl={signInPath} />}
      <p className="auth-legal">A clear record belongs to everyone on the team.</p>
    </div>
  </main>;
}
function AdminSignInRoute() {
  return <><Show when="signed-in"><Redirect to="/admin" /></Show><Show when="signed-out"><AuthRoute mode="in" adminLogin /></Show></>;
}

function Protected({ children, supervisor = false }: { children: (member: Member) => ReactNode; supervisor?: boolean }) {
  return <><Show when="signed-out"><Redirect to="/" /></Show><Show when="signed-in"><ProfileGate supervisor={supervisor}>{children}</ProfileGate></Show></>;
}
function isMissingProfile(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { status?: number; response?: { status?: number }; message?: string };
  return value.status === 404 || value.response?.status === 404 || /(^|\D)404(\D|$)/.test(value.message ?? '');
}
function ProfileGate({ children, supervisor }: { children: (member: Member) => ReactNode; supervisor: boolean }) {
  const profile = useGetMyProfile();
  if (profile.isLoading) return <div className="protected-loading"><div className="loading-brand"><Logo /><span className="skeleton" /></div><SkeletonLines /></div>;
  if (profile.isError) return isMissingProfile(profile.error) ? <ProfileOnboarding /> : <div className="protected-error"><QueryError message={getError(profile.error)} retry={() => void profile.refetch()} /></div>;
  if (!profile.data) return null;
  return supervisor && profile.data.role !== 'supervisor' ? <Redirect to="/dashboard" /> : children(profile.data);
}
function AdminHome() {
  return <Protected supervisor>{() => <Redirect to="/reports" />}</Protected>;
}
function ProfileOnboarding() {
  const { user, isLoaded } = useUser();
  const saveProfile = useSaveMyProfile();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';
  const suggestedUsername = user?.username || email.split('@')[0] || '';
  const [form, setForm] = useState<ProfileInput>({ email, username: suggestedUsername, firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (user) setForm((current) => ({
      ...current,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? current.email,
      username: current.username || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || '',
      firstName: current.firstName || user.firstName || '',
      lastName: current.lastName || user.lastName || '',
    }));
  }, [user]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.username.trim().length < 2 || !form.firstName.trim() || !form.lastName.trim()) { setError('Add a username and both names to continue.'); return; }
    setError('');
    saveProfile.mutate({ data: { email: form.email, username: form.username.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() } }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); setLocation('/dashboard'); },
      onError: (reason) => setError(getError(reason)),
    });
  }
  if (!isLoaded) return <div className="protected-loading"><div className="loading-brand"><Logo /><span className="skeleton" /></div><SkeletonLines count={2} /></div>;
  return <main className="onboarding-page"><div className="onboarding-side"><Link href="/" className="brand-link"><Logo inverse /></Link><div className="onboarding-words"><span className="eyebrow">BEFORE THE FIRST ENTRY</span><h1>Put a name<br />to the <em>work.</em></h1><p>Your journal is personal to you. These details help your team know who’s behind each update.</p><div className="onboarding-assurance"><ShieldCheck size={16} />Your account uses your secure sign-in.</div></div><span className="onboarding-footer">DAYBOOK · A CLEAR RECORD OF THE WORKDAY</span></div>
    <section className="onboarding-form-side"><div className="onboarding-form-wrap"><div className="eyebrow"><span className="eyebrow-dot" />SET UP YOUR PROFILE</div><h2>Welcome to Daybook.</h2><p className="onboarding-intro">A couple of details, then you’re ready to begin your work log.</p>
      <form onSubmit={submit} className="onboarding-form"><label className="field">Work email<input type="email" value={form.email} readOnly aria-describedby="email-hint" data-testid="input-onboarding-email" /></label><small id="email-hint" className="onboarding-hint">From your sign-in account</small>
        <div className="form-grid two"><label className="field">First name<input autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required data-testid="input-onboarding-first-name" /></label><label className="field">Last name<input autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required data-testid="input-onboarding-last-name" /></label></div>
        <label className="field">Username<input autoComplete="username" minLength={2} maxLength={40} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required data-testid="input-onboarding-username" /><span className="onboarding-hint">At least 2 characters. This helps teammates find you.</span></label>
        {error && <p className="form-error" role="alert" data-testid="status-onboarding-error">{error}</p>}
        <Button type="submit" disabled={saveProfile.isPending || !email} data-testid="button-complete-onboarding">{saveProfile.isPending ? <><LoaderCircle size={15} className="spin" /> Saving your profile…</> : <>Continue to your work log <ArrowRight size={16} /></>}</Button>
        {!email && <p className="form-error">We couldn’t read an email from your sign-in account. Please sign out and try again.</p>}
      </form><div className="onboarding-footnote"><LockKeyhole size={14} /><span>Your profile is shared with your team. Access level is assigned automatically.</span></div>
    </div></section>
  </main>;
}

function AppFrame({ member, active, children }: { member: Member; active: string; children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const { signOut } = useClerk();
  const [location] = useLocation();
  const supervisor = member.role === 'supervisor';
  const nav = [{ href: '/dashboard', label: 'My work log', icon: ClipboardList }, { href: '/reports', label: supervisor ? 'Weekly reports' : 'My reports', icon: BarChart3 }, ...(supervisor ? [{ href: '/team', label: 'Team access', icon: Users }] : [])];
  return <div className="workspace">
    <aside className="sidebar"><Link href="/dashboard" className="side-brand" data-testid="link-sidebar-brand"><Logo inverse /></Link>
      <div className="side-caption">WORKSPACE</div><nav className="side-nav" aria-label="Workspace navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${active === href ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{active === href && <span className="nav-indicator" />}</Link>)}</nav>
      <div className="side-bottom"><div className="side-help"><span className="help-icon"><CircleHelp size={15} /></span><span><strong>Keep the record clear</strong><small>Good details make great handoffs.</small></span></div><button className="side-logout" onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={16} /> Sign out</button></div>
    </aside>
    {mobileNav && <div className="mobile-nav-overlay" onClick={() => setMobileNav(false)}><div className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}><div className="mobile-nav-head"><Logo /><button aria-label="Close navigation" onClick={() => setMobileNav(false)} data-testid="button-close-nav"><X size={19} /></button></div>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} onClick={() => setMobileNav(false)} data-testid={`link-mobile-${href.slice(1)}`}><Icon size={17} />{label}</Link>)}</div></div>}
    <main className="main-workspace"><header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)} data-testid="button-open-nav"><Menu size={20} /></button><div className="breadcrumb"><span>Daybook</span><span className="crumb-slash">/</span><strong>{active === '/dashboard' ? 'My work log' : active === '/reports' ? supervisor ? 'Weekly reports' : 'My reports' : 'Team access'}</strong></div><div className="topbar-user"><span className="role-chip">{supervisor ? 'SUPERVISOR' : 'EMPLOYEE'}</span><Avatar name={initialsName(member)} size="small" /><div><strong>{initialsName(member)}</strong><small>{member.email}</small></div><button title="Sign out" aria-label="Sign out" className="top-signout" onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out-top"><LogOut size={16} /></button></div></header><div className="page-content">{children}</div></main>
  </div>;
}

type TaskFormValues = Omit<TaskInput, 'date' | 'time'> & { date: string; time: string };
const emptyForm = (): TaskFormValues => ({ date: todayISO(), time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`, activity: '', department: '', actionTaken: '', status: 'done', remarks: '' });
function TaskDialog({ task, close, onSave, pending }: { task?: Task; close: () => void; onSave: (data: TaskInput | TaskUpdate) => void; pending: boolean }) {
  const [form, setForm] = useState<TaskFormValues>(() => task ? { date: task.date.slice(0, 10), time: task.time, activity: task.activity, department: task.department, actionTaken: task.actionTaken, status: task.status, remarks: task.remarks } : emptyForm());
  const [formError, setFormError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.activity.trim() || !form.department.trim()) { setFormError('Add a problem and a department or person served to save this entry.'); return; }
    setFormError('');
    onSave({ ...form, activity: form.activity.trim(), department: form.department.trim(), actionTaken: form.actionTaken.trim(), remarks: form.remarks.trim() });
  }
  function change(key: keyof TaskFormValues, value: string) { setForm((old) => ({ ...old, [key]: value } as TaskFormValues)); }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !pending) close(); }}><section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title"><div className="dialog-header"><div><span className="eyebrow">WORKDAY ENTRY</span><h2 id="task-dialog-title">{task ? 'Refine this entry' : 'Record a piece of work'}</h2><p>Keep it specific. A useful log makes the next step clear.</p></div><button className="icon-button" aria-label="Close dialog" onClick={close} disabled={pending} data-testid="button-close-task-form"><X size={18} /></button></div>
    <form onSubmit={submit}><div className="form-grid two"><label className="field">Date<input type="date" value={form.date} onChange={(e) => change('date', e.target.value)} required data-testid="input-task-date" /></label><label className="field">Time<input type="time" value={form.time} onChange={(e) => change('time', e.target.value)} required data-testid="input-task-time" /></label></div>
       <label className="field">Problem<input maxLength={300} placeholder="e.g. Missing stock delayed the afternoon dispatch" value={form.activity} onChange={(e) => change('activity', e.target.value)} required data-testid="input-task-activity" /></label>
      <label className="field">Department / user served<input maxLength={120} placeholder="e.g. Operations or a colleague's name" value={form.department} onChange={(e) => change('department', e.target.value)} required data-testid="input-task-department" /></label>
      <label className="field">Action taken <span className="optional">OPTIONAL</span><textarea maxLength={2000} placeholder="What did you do, and what changed?" value={form.actionTaken} onChange={(e) => change('actionTaken', e.target.value)} data-testid="input-task-action" /></label>
      <div className="form-grid two"><fieldset className="field status-field"><legend>Status</legend><div className="status-options"><label className={`status-choice ${form.status === 'done' ? 'selected' : ''}`}><input type="checkbox" checked={form.status === 'done'} onChange={(e) => { if (e.target.checked) change('status', 'done'); }} data-testid="checkbox-task-status-done" /><span className="status-check"><Check size={13} /></span><span>Done</span></label><label className={`status-choice ${form.status === 'pending' ? 'selected' : ''}`}><input type="checkbox" checked={form.status === 'pending'} onChange={(e) => { if (e.target.checked) change('status', 'pending'); }} data-testid="checkbox-task-status-pending" /><span className="status-check"><Check size={13} /></span><span>Pending</span></label></div></fieldset><label className="field">Remarks <span className="optional">OPTIONAL</span><input maxLength={2000} placeholder="A handoff or reminder" value={form.remarks} onChange={(e) => change('remarks', e.target.value)} data-testid="input-task-remarks" /></label></div>
      {formError && <p className="form-error" role="alert">{formError}</p>}<div className="dialog-actions"><Button type="button" variant="secondary" onClick={close} disabled={pending} data-testid="button-cancel-task">Cancel</Button><Button type="submit" disabled={pending} data-testid="button-save-task">{pending ? <><LoaderCircle size={15} className="spin" /> Saving…</> : <><Check size={15} /> {task ? 'Save changes' : 'Add to today'}</>}</Button></div>
    </form></section></div>;
}

function TaskStatus({ status }: { status: Task['status'] }) {
  return <span className={`status-pill ${status}`} data-testid={`status-task-${status}`}><i />{status === 'done' ? 'Complete' : 'In progress'}</span>;
}
function DashboardPage({ member }: { member: Member }) {
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogTask, setDialogTask] = useState<Task | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentMonday = isoDate(mondayOf(new Date()));
  const today = todayISO();
  const filters = useMemo(() => ({
    ...(range === 'today' ? { from: today, to: today } : range === 'week' ? { from: currentMonday, to: today } : {}),
    ...(statusFilter === 'all' ? {} : { status: statusFilter as 'done' | 'pending' }),
  }), [range, statusFilter, currentMonday, today]);
  const tasksQuery = useListTasks(filters);
  const create = useCreateTask(); const update = useUpdateTask(); const remove = useDeleteTask(); const saveProfile = useSaveMyProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileInput>({ email: member.email, username: member.username, firstName: member.firstName, lastName: member.lastName });
  const [notice, setNotice] = useState('');
  const tasks = [...(tasksQuery.data ?? [])].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const done = tasks.filter((item) => item.status === 'done').length;
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetWeeklyReportQueryKey() });
  }
  function openCreate() { setDialogTask(undefined); setDialogOpen(true); }
  function submitTask(data: TaskInput | TaskUpdate) {
    if (dialogTask) update.mutate({ id: dialogTask.id, data: data as TaskUpdate }, { onSuccess: () => { invalidate(); setDialogOpen(false); setDialogTask(undefined); setNotice('Your changes are saved.'); }, onError: (e) => setNotice(getError(e)) });
    else create.mutate({ data: data as TaskInput }, { onSuccess: () => { invalidate(); setDialogOpen(false); setNotice('Entry added to your work log.'); }, onError: (e) => setNotice(getError(e)) });
  }
  function editTask(task: Task) { setDialogTask(task); setDialogOpen(true); }
  function deleteTask(task: Task) { if (window.confirm(`Remove “${task.activity}” from your log? This cannot be undone.`)) remove.mutate({ id: task.id }, { onSuccess: () => { invalidate(); setNotice('Entry removed.'); }, onError: (e) => setNotice(getError(e)) }); }
  function saveMemberProfile(e: FormEvent) { e.preventDefault(); saveProfile.mutate({ data: profileForm }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); setProfileOpen(false); setNotice('Profile updated.'); }, onError: (e) => setNotice(getError(e)) }); }
  return <AppFrame member={member} active="/dashboard"><section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />YOUR DAILY RECORD</div><h1>My work log</h1><p>A clear account of what you moved forward today.</p></div><Button onClick={openCreate} data-testid="button-new-task"><Plus size={17} /> New entry</Button></section>
    <div className="day-banner"><div className="day-banner-icon"><CalendarDays size={18} /></div><div><span>{range === 'today' ? `TODAY, ${new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}` : range === 'week' ? 'THIS WORKWEEK' : 'ALL RECORDED WORK'}</span><strong>{done} of {tasks.length} entries completed</strong></div><div className="day-progress"><span style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div></div>
    <div className="toolbar-row"><div className="segmented" role="group" aria-label="Filter tasks by date">{(['today', 'week', 'all'] as const).map((item) => <button key={item} className={range === item ? 'selected' : ''} onClick={() => setRange(item)} data-testid={`button-range-${item}`}>{item === 'today' ? 'Today' : item === 'week' ? 'This week' : 'All entries'}</button>)}</div><label className="filter-select"><Filter size={14} /><select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-status-filter"><option value="all">All statuses</option><option value="done">Complete</option><option value="pending">In progress</option></select><ChevronDown size={13} /></label></div>
    {notice && <div className="inline-notice" role="status" data-testid="status-notice"><span><CheckCircle2 size={15} /></span>{notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')} data-testid="button-dismiss-notice"><X size={14} /></button></div>}
    {tasksQuery.isLoading ? <SkeletonLines count={4} /> : tasksQuery.isError ? <QueryError message={getError(tasksQuery.error)} retry={() => void tasksQuery.refetch()} /> : tasks.length === 0 ? <EmptyState title={range === 'today' ? 'A clean page for today.' : 'No entries in this view.'} detail="When you make progress, leave a short note here. The team can follow the work from there." action={<Button onClick={openCreate} data-testid="button-empty-new-task"><Plus size={16} /> Record your first entry</Button>} /> :
      <section className="task-list" aria-label="Your task entries">{tasks.map((task) => <article className="task-card" key={task.id} data-testid={`card-task-${task.id}`}><div className="task-time">{task.time}<span>{formatDate(task.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div><div className="task-main"><div className="task-title-line"><h2>{task.activity}</h2><TaskStatus status={task.status} /></div><div className="task-meta"><span className="department-label">{task.department}</span>{task.actionTaken && <span>{task.actionTaken}</span>}</div>{task.remarks && <p className="task-note">{task.remarks}</p>}{task.comments?.length > 0 && <div className="task-comment-preview"><MessageSquareText size={14} /><span>{task.comments.length} supervisor {task.comments.length === 1 ? 'note' : 'notes'}</span><span className="comment-latest">“{task.comments[task.comments.length - 1].comment}”</span></div>}</div><div className="task-actions"><button className="icon-button" aria-label={`Edit ${task.activity}`} onClick={() => editTask(task)} data-testid={`button-edit-task-${task.id}`}><Pencil size={15} /></button><button className="icon-button icon-danger" aria-label={`Delete ${task.activity}`} onClick={() => deleteTask(task)} disabled={remove.isPending} data-testid={`button-delete-task-${task.id}`}><Trash2 size={15} /></button></div></article>)}</section>}
    <div className="page-bottom-note"><ShieldCheck size={16} /><span>Your entries are visible to you and your supervisors.</span><button onClick={() => setProfileOpen((v) => !v)} data-testid="button-edit-profile"><UserRound size={14} /> Edit profile</button></div>
    {dialogOpen && <TaskDialog task={dialogTask} close={() => { setDialogOpen(false); setDialogTask(undefined); }} onSave={submitTask} pending={dialogTask ? update.isPending : create.isPending} />}
    {profileOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setProfileOpen(false); }}><section className="task-dialog profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="dialog-header"><div><span className="eyebrow">YOUR ACCOUNT</span><h2 id="profile-title">Profile details</h2><p>Keep your team directory information current.</p></div><button className="icon-button" aria-label="Close profile" onClick={() => setProfileOpen(false)} data-testid="button-close-profile"><X size={18} /></button></div><form onSubmit={saveMemberProfile}><label className="field">Email<input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required data-testid="input-profile-email" /></label><div className="form-grid two"><label className="field">First name<input value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} required data-testid="input-profile-first-name" /></label><label className="field">Last name<input value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} required data-testid="input-profile-last-name" /></label></div><label className="field">Username<input value={profileForm.username} minLength={2} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} required data-testid="input-profile-username" /></label><div className="dialog-actions"><Button type="button" variant="secondary" onClick={() => setProfileOpen(false)} data-testid="button-cancel-profile">Cancel</Button><Button type="submit" disabled={saveProfile.isPending} data-testid="button-save-profile">{saveProfile.isPending ? 'Saving…' : 'Save profile'}</Button></div></form></section></div>}
  </AppFrame>;
}

function ReportsPage({ member }: { member: Member }) {
  const isSupervisor = member.role === 'supervisor';
  const [week, setWeek] = useState(() => isoDate(mondayOf(new Date())));
  const [selectedMember, setSelectedMember] = useState('all');
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [commentNotice, setCommentNotice] = useState('');
  const [wordExporting, setWordExporting] = useState(false);
  const [wordExportError, setWordExportError] = useState('');
  const queryClient = useQueryClient();
  const reportQuery = useGetWeeklyReport({ weekStart: week });
  const report: WeeklyReport | undefined = reportQuery.data;
  const endDate = useMemo(() => { const end = new Date(`${week}T12:00:00`); end.setDate(end.getDate() + 6); return isoDate(end); }, [week]);
  const tasksQuery = useListTasks({ from: week, to: endDate, ...(isSupervisor && selectedMember !== 'all' ? { memberId: selectedMember } : {}) });
  const commentMutation = useAddTaskComment();
  const membersQuery = useListMembers({ query: { enabled: isSupervisor, queryKey: getListMembersQueryKey() } });
  const sortedTasks = useMemo(() => [...(tasksQuery.data ?? [])].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [tasksQuery.data]);
  const selectedPerson = isSupervisor ? membersQuery.data?.find((person) => person.id === selectedMember) : undefined;
  const printTaskScope = isSupervisor ? selectedMember === 'all' ? 'All team members' : selectedPerson ? initialsName(selectedPerson) : 'Selected team member' : initialsName(member);
  const reportError = reportQuery.isError || tasksQuery.isError || (isSupervisor && membersQuery.isError);
  const reportBusy = reportQuery.isFetching || tasksQuery.isFetching || (isSupervisor && membersQuery.isFetching);
  const reportLoading = reportQuery.isLoading || tasksQuery.isLoading || (isSupervisor && membersQuery.isLoading);
  const activeDays = new Set(sortedTasks.map((task) => task.date)).size;
  function shiftWeek(direction: number) { const next = new Date(`${week}T12:00:00`); next.setDate(next.getDate() + direction * 7); setWeek(isoDate(next)); }
  function submitComment(e: FormEvent, taskId: number) { e.preventDefault(); if (!comment.trim()) return; commentMutation.mutate({ id: taskId, data: { comment: comment.trim() } }, { onSuccess: () => { setComment(''); setCommentFor(null); setCommentNotice('Review note added.'); void queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetWeeklyReportQueryKey() }); }, onError: (error) => setCommentNotice(getError(error)) }); }
  function printReport() {
    if (!report || reportError || reportBusy) return;
    window.print();
  }
  async function downloadWordReport() {
    if (!report || reportError || reportBusy || wordExporting) return;
    setWordExporting(true);
    setWordExportError('');
    try {
      const blob = await buildWeeklyReportDocx({ report, tasks: sortedTasks, isSupervisor, reportOwner: initialsName(member), taskScope: printTaskScope });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `daybook-${isSupervisor ? 'team' : 'personal'}-weekly-report-${week}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setWordExportError('The Word report could not be created. Please try again.');
    } finally {
      setWordExporting(false);
    }
  }
  return <AppFrame member={member} active="/reports"><div className="reports-page">
    {report && <header className="report-document-header"><div className="report-document-brand"><Logo /><div><span>{isSupervisor ? 'SUPERVISOR REPORT' : 'PERSONAL REPORT'}</span><h2>{isSupervisor ? 'Weekly team report' : 'My weekly report'}</h2></div></div><div className="report-document-period"><span>REPORTING PERIOD</span><strong>{formatDate(report.weekStart)} — {formatDate(report.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><small>{isSupervisor ? `Task details: ${printTaskScope}` : `Prepared for: ${printTaskScope}`}</small></div></header>}
    <section className="page-heading report-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />{isSupervisor ? 'SUPERVISOR VIEW' : 'YOUR WEEKLY REPORT'}</div><h1>{isSupervisor ? 'The week, in view.' : 'Your week, in view.'}</h1><p>{isSupervisor ? 'Read the work behind the numbers. Leave a note where it helps.' : 'Review your weekly work, then print or download your report.'}</p></div><div className="report-actions"><div className="week-control"><button className="icon-button" aria-label="Previous week" onClick={() => shiftWeek(-1)} data-testid="button-previous-week"><ChevronLeft size={17} /></button><span><CalendarDays size={15} />{report ? `${formatDate(report.weekStart)} — ${formatDate(report.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}` : `${formatDate(week)} — ${formatDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`}</span><button className="icon-button" aria-label="Next week" onClick={() => shiftWeek(1)} disabled={week >= isoDate(mondayOf(new Date()))} data-testid="button-next-week"><ChevronRight size={17} /></button></div><Button variant="secondary" type="button" onClick={printReport} disabled={!report || reportError || reportBusy} title="Print or save as PDF" data-testid="button-print-weekly-report"><Printer size={15} /> Print report</Button><Button type="button" onClick={() => void downloadWordReport()} disabled={!report || reportError || reportBusy || wordExporting} title="Download an editable Word document" data-testid="button-download-word-report"><FileText size={15} /> {wordExporting ? 'Preparing…' : 'Download Word'}</Button></div></section>
    {reportError && (reportQuery.isError ? <QueryError message={getError(reportQuery.error)} retry={() => void reportQuery.refetch()} /> : tasksQuery.isError ? <QueryError message={getError(tasksQuery.error)} retry={() => void tasksQuery.refetch()} /> : <QueryError message={getError(membersQuery.error)} retry={() => void membersQuery.refetch()} />)}
    {wordExportError && <div className="inline-notice report-export-error" role="alert">{wordExportError}</div>}
    <section className="report-metrics">{reportLoading ? [1, 2, 3, 4].map((x) => <div className="metric metric-skeleton" key={x}><div className="skeleton" /><div className="skeleton" /></div>) : report ? <>
      <Metric label={isSupervisor ? 'ENTRIES LOGGED' : 'MY ENTRIES'} value={report.totalTasks} note={isSupervisor ? 'across the team' : 'recorded this week'} icon={<ClipboardList size={17} />} tone="teal" />
      <Metric label="COMPLETED" value={report.completedTasks} note={`${report.pendingTasks} still in progress`} icon={<CheckCircle2 size={17} />} tone="green" />
      <Metric label="COMPLETION RATE" value={`${Math.round(report.completionRate)}%`} note="for this reporting week" icon={<Activity size={17} />} tone="orange" />
      <Metric label={isSupervisor ? 'CONTRIBUTORS' : 'ACTIVE DAYS'} value={isSupervisor ? report.members.filter((item) => item.totalTasks > 0).length : activeDays} note={isSupervisor ? 'with recorded activity' : 'with at least one entry'} icon={isSupervisor ? <Users size={17} /> : <CalendarDays size={17} />} tone="blue" />
    </> : null}</section>
    {report && <section className="performance-panel"><div className="panel-head"><div><span className="eyebrow">{isSupervisor ? 'TEAM PULSE' : 'YOUR PROGRESS'}</span><h2>{isSupervisor ? 'Progress by person' : 'Your weekly progress'}</h2></div><span className="panel-period">{formatDate(report.weekStart)} — {formatDate(report.weekEnd, { month: 'short', day: 'numeric' })}</span></div>
      {report.totalTasks === 0 ? <EmptyState title={isSupervisor ? 'No team activity in this week.' : 'No entries this week yet.'} detail={isSupervisor ? 'Once your team has logged work, each person’s progress will appear here.' : 'Your weekly progress will appear here after you record your first entry.'} /> : <div className="performance-table-wrap"><table className="performance-table"><thead><tr><th>{isSupervisor ? 'TEAM MEMBER' : 'YOUR NAME'}</th><th>ENTRIES</th><th>COMPLETE</th><th>IN PROGRESS</th><th>COMPLETION</th></tr></thead><tbody>{report.members.map((item) => <tr key={item.memberId} data-testid={`row-performance-${item.memberId}`}><td><div className="member-cell"><Avatar name={item.memberName} size="small" /><span><strong>{item.memberName}</strong><small>{item.role}</small></span></div></td><td>{item.totalTasks}</td><td>{item.completedTasks}</td><td>{item.pendingTasks}</td><td><div className="rate-cell"><span>{Math.round(item.completionRate)}%</span><div className="rate-track"><i style={{ width: `${Math.max(0, Math.min(item.completionRate, 100))}%` }} /></div></div></td></tr>)}</tbody></table></div>}
    </section>}
    <section className="review-section"><div className="review-head"><div><span className="eyebrow">{isSupervisor ? 'TASK-BY-TASK REVIEW' : 'YOUR ENTRIES'}</span><h2>{isSupervisor ? 'What got done' : 'What you worked on'}</h2><p>{isSupervisor ? 'Specific work, with a place to follow up.' : 'Problems, actions, notes, and supervisor feedback for this week.'}</p></div>{isSupervisor && <label className="member-filter"><Users size={15} /><select aria-label="Filter report by team member" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} data-testid="select-report-member"><option value="all">Everyone</option>{membersQuery.data?.map((person) => <option key={person.id} value={person.id}>{initialsName(person)}</option>)}</select><ChevronDown size={13} /></label>}</div>
      {commentNotice && <div className="inline-notice" role="status" data-testid="status-comment-notice"><span><MessageSquareText size={15} /></span>{commentNotice}<button onClick={() => setCommentNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-comment-notice"><X size={14} /></button></div>}
      {tasksQuery.isLoading ? <SkeletonLines count={4} /> : tasksQuery.isError ? <QueryError message={getError(tasksQuery.error)} retry={() => void tasksQuery.refetch()} /> : sortedTasks.length === 0 ? <EmptyState title="Nothing to review just yet." detail="Task entries for the selected week will be collected here." /> : <div className="review-list">{sortedTasks.map((task) => <article className="review-card" key={task.id} data-testid={`review-task-${task.id}`}><div className="review-card-top"><Avatar name={task.memberName} size="small" /><div className="review-owner"><strong>{task.memberName}</strong><span>{formatDate(task.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {task.time} · {task.department}</span></div><TaskStatus status={task.status} /></div><h3>{task.activity}</h3>{task.actionTaken && <p className="review-detail"><span>ACTION</span>{task.actionTaken}</p>}{task.remarks && <p className="review-detail"><span>NOTE</span>{task.remarks}</p>}
        {task.comments?.length > 0 && <div className="comments-list">{task.comments.map((item) => <div key={item.id} className="comment-item"><span className="comment-avatar">{item.supervisorName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><div className="comment-by"><strong>{item.supervisorName}</strong><span>{formatDate(item.createdAt, { month: 'short', day: 'numeric' })}</span></div><p>{item.comment}</p></div></div>)}</div>}
        {isSupervisor && (commentFor === task.id ? <form className="comment-form" onSubmit={(e) => submitComment(e, task.id)}><label className="sr-only" htmlFor={`comment-${task.id}`}>Supervisor review comment</label><textarea id={`comment-${task.id}`} maxLength={2000} placeholder="Add a useful observation or follow-up…" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus data-testid={`input-comment-${task.id}`} /><div><button type="button" className="btn btn-quiet" onClick={() => { setCommentFor(null); setComment(''); }} data-testid={`button-cancel-comment-${task.id}`}>Cancel</button><Button type="submit" disabled={!comment.trim() || commentMutation.isPending} data-testid={`button-submit-comment-${task.id}`}>{commentMutation.isPending ? 'Adding…' : 'Add note'}</Button></div></form> : <button className="review-comment-button" onClick={() => { setCommentFor(task.id); setComment(''); }} data-testid={`button-comment-task-${task.id}`}><MessageSquareText size={15} />{task.comments?.length ? 'Add another note' : 'Leave a review note'}</button>)}
      </article>)}</div>}
    </section>
  </div></AppFrame>;
}
function Metric({ label, value, note, icon, tone }: { label: string; value: string | number; note: string; icon: ReactNode; tone: string }) {
  return <div className={`metric metric-${tone}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></div>;
}

function TeamPage({ member }: { member: Member }) {
  const membersQuery = useListMembers();
  const updateRole = useUpdateMemberRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const members = useMemo(() => (membersQuery.data ?? []).filter((person) => `${initialsName(person)} ${person.email} ${person.username}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => initialsName(a).localeCompare(initialsName(b))), [membersQuery.data, search]);
  function changeRole(person: Member) {
    const role = person.role === 'supervisor' ? 'employee' : 'supervisor';
    const action = role === 'supervisor' ? 'grant supervisor access to' : 'remove supervisor access from';
    if (!window.confirm(`Are you sure you want to ${action} ${initialsName(person)}?`)) return;
    updateRole.mutate({ id: person.id, data: { role } }, { onSuccess: () => { setNotice(`${initialsName(person)} is now ${role === 'supervisor' ? 'a supervisor' : 'an employee'}.`); void queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetWeeklyReportQueryKey() }); }, onError: (error) => setNotice(getError(error)) });
  }
  return <AppFrame member={member} active="/team"><section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />PEOPLE & PERMISSIONS</div><h1>Team access</h1><p>Know who’s here, and who can review the work.</p></div><div className="team-count">{membersQuery.data?.length ?? '—'}<span>TEAM MEMBERS</span></div></section>
    <section className="team-intro"><div className="team-intro-icon"><LockKeyhole size={18} /></div><div><strong>Access stays intentional.</strong><p>Supervisors can review every team log, add comments, and see weekly performance. Employees manage their own entries.</p></div><span className="permission-key"><i className="key-supervisor" /> Supervisor <i className="key-employee" /> Employee</span></section>
    {notice && <div className="inline-notice" role="status" data-testid="status-role-notice"><span><CheckCircle2 size={15} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-role-notice"><X size={14} /></button></div>}
    <section className="team-list-panel"><div className="team-list-head"><div><span className="eyebrow">MEMBER DIRECTORY</span><h2>People on this team</h2></div><label className="search-box"><Search size={15} /><input type="search" placeholder="Find a teammate" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search team members" data-testid="input-search-members" /><kbd>⌘ K</kbd></label></div>
      {membersQuery.isLoading ? <SkeletonLines count={4} /> : membersQuery.isError ? <QueryError message={getError(membersQuery.error)} retry={() => void membersQuery.refetch()} /> : members.length === 0 ? <EmptyState title={search ? 'No matches found.' : 'No team members yet.'} detail={search ? 'Try a different name, email, or username.' : 'Team members appear here as they join Daybook.'} /> : <div className="member-list">{members.map((person) => { const self = person.id === member.id; return <article className="member-row" key={person.id} data-testid={`row-member-${person.id}`}><Avatar name={initialsName(person)} /><div className="member-info"><strong>{initialsName(person)} {self && <span className="you-tag">YOU</span>}</strong><span>{person.email}</span></div><div className={`role-badge ${person.role}`}><span />{person.role}</div><span className="member-since">Joined {formatDate(person.createdAt)}</span><button className={`access-toggle ${person.role === 'supervisor' ? 'has-access' : ''}`} onClick={() => changeRole(person)} disabled={self || updateRole.isPending} title={self ? 'You cannot change your own access here' : person.role === 'supervisor' ? 'Remove supervisor access' : 'Grant supervisor access'} data-testid={`button-toggle-role-${person.id}`}>{updateRole.isPending ? <LoaderCircle size={15} className="spin" /> : person.role === 'supervisor' ? <><ShieldCheck size={15} /> Supervisor access</> : <><Plus size={15} /> Grant supervisor access</>}</button></article>; })}</div>}
    </section><div className="team-footnote"><ShieldCheck size={15} /><span>Role changes take effect immediately for the member.</span></div>
  </AppFrame>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const prevUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => { const id = user?.id ?? null; if (prevUser.current !== undefined && prevUser.current !== id) cache.clear(); prevUser.current = id; });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  function navigateClerkRoute(to: string, replace = false) {
    const target = new URL(to, window.location.href);
    if (target.origin !== window.location.origin) {
      if (replace) window.location.replace(target.href);
      else window.location.assign(target.href);
      return;
    }

    const path = stripBase(`${target.pathname}${target.search}${target.hash}`);
    if (replace) setLocation(path, { replace: true });
    else setLocation(path);
  }
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your team left off.' } }, signUp: { start: { title: 'Start your work journal', subtitle: 'Make a clear record of the workday.' } } }}
    routerPush={(to) => navigateClerkRoute(to)} routerReplace={(to) => navigateClerkRoute(to, true)}>
    <ClerkCacheInvalidator /><Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/admin/sign-in/*?" component={AdminSignInRoute} />
      <Route path="/admin" component={AdminHome} />
      <Route path="/sign-in/*?" component={() => <AuthRoute mode="in" />} />
      <Route path="/sign-up/*?" component={() => <AuthRoute mode="up" />} />
      <Route path="/dashboard" component={() => <Protected>{(member) => <DashboardPage member={member} />}</Protected>} />
      <Route path="/reports" component={() => <Protected>{(member) => <ReportsPage member={member} />}</Protected>} />
      <Route path="/team" component={() => <Protected supervisor>{(member) => <TeamPage member={member} />}</Protected>} />
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}
function NotFound() {
  return <main className="not-found"><Logo /><span className="eyebrow">PAGE NOT FOUND</span><h1>This page isn’t in the log.</h1><p>The address may have changed, or the page may not exist.</p><Link href="/" className="btn btn-primary" data-testid="link-not-found-home"><ArrowLeft size={15} /> Back to daybook</Link></main>;
}
function App() {
  if (!clerkPubKey) {
    return <main className="landing flex min-h-screen items-center justify-center p-6">
      <section className="surface w-full max-w-xl p-8 text-center sm:p-10">
        <Logo />
        <p className="eyebrow mt-8">SETUP REQUIRED</p>
        <h1 className="font-display mt-3 text-3xl font-semibold">Authentication isn’t configured</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Daybook needs a Clerk publishable key to load sign-in. Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to the web app environment and restart the dev server.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The API also needs <code>CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code>.
        </p>
      </section>
    </main>;
  }
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter></QueryClientProvider>;
}
export default App;
