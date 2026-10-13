import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Task, WeeklyReport } from '@workspace/api-client-react';

const pageWidth = 15398;

function displayDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 40 },
    children: [new TextRun({
      text: text || '—',
      bold: options.bold,
      size: options.size ?? 18,
      color: options.color ?? '263D38',
    })],
  });
}

function makeCell(text: string, width: number, isHeader = false) {
  const lines = (text || '—').split('\n');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, right: 100, bottom: 90, left: 100 },
    children: lines.map((line) => paragraph(line, {
      bold: isHeader,
      size: isHeader ? 16 : 17,
      color: isHeader ? '244F47' : '263D38',
    })),
  });
}

function makeTable(headers: string[], data: string[][], widths: number[]) {
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((header, index) => makeCell(header, widths[index], true)) }),
    ...data.map((row) => new TableRow({ cantSplit: true, children: row.map((value, index) => makeCell(value, widths[index])) })),
  ];
  return new Table({
    width: { size: pageWidth, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    style: 'TableGrid',
    alignment: AlignmentType.CENTER,
    rows,
  });
}

export async function buildWeeklyReportDocx({
  report,
  tasks,
  isSupervisor,
  reportOwner,
  taskScope,
}: {
  report: WeeklyReport;
  tasks: Task[];
  isSupervisor: boolean;
  reportOwner: string;
  taskScope: string;
}): Promise<Blob> {
  const activeDays = new Set(tasks.map((task) => task.date)).size;
  const contributors = report.members.filter((member) => member.totalTasks > 0).length;
  const summary = [
    ['Entries', String(report.totalTasks)],
    ['Completed', String(report.completedTasks)],
    ['In progress', String(report.pendingTasks)],
    ['Completion rate', `${Math.round(report.completionRate)}%`],
    [isSupervisor ? 'Contributors' : 'Active days', String(isSupervisor ? contributors : activeDays)],
  ];
  const performanceRows = report.members.map((item) => [
    item.memberName,
    item.role,
    String(item.totalTasks),
    String(item.completedTasks),
    String(item.pendingTasks),
    `${Math.round(item.completionRate)}%`,
  ]);
  const taskRows = tasks.map((task) => {
    const notes = [
      task.remarks ? `Note: ${task.remarks}` : '',
      ...task.comments.map((comment) => `Supervisor (${displayDate(comment.createdAt)}): ${comment.comment}`),
    ].filter(Boolean).join('\n');
    return [
      `${displayDate(task.date)}\n${task.time}`,
      task.department,
      task.activity,
      task.actionTaken || '—',
      task.status === 'done' ? 'Complete' : 'In progress',
      notes || '—',
    ];
  });
  if (taskRows.length === 0) taskRows.push(['No entries recorded this week.', '—', '—', '—', '—', '—']);

  const document = new Document({
    creator: 'Daybook',
    title: `${isSupervisor ? 'Team' : 'Personal'} weekly report — ${report.weekStart}`,
    description: `Daybook weekly report for ${report.weekStart} to ${report.weekEnd}`,
    sections: [{
      properties: {
        page: {
          size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'DAYBOOK  /  WEEKLY REPORT', bold: true, size: 18, color: '326C65' })] }),
        new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 100 }, children: [new TextRun({ text: isSupervisor ? 'Team weekly report' : 'Personal weekly report', bold: true, size: 34, color: '203B3B' })] }),
        paragraph(`Reporting period: ${displayDate(report.weekStart)} – ${displayDate(report.weekEnd)}`, { bold: true, size: 20, after: 40 }),
        paragraph(isSupervisor ? `Task details: ${taskScope}` : `Prepared for: ${reportOwner}`, { size: 18, after: 240 }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 100, after: 100 }, children: [new TextRun({ text: 'Weekly summary', bold: true, size: 24, color: '203B3B' })] }),
        makeTable(summary.map(([label]) => label), [summary.map(([, value]) => value)], [3080, 3079, 3079, 3080, 3080]),
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 100 }, children: [new TextRun({ text: isSupervisor ? 'Team performance' : 'Your weekly performance', bold: true, size: 24, color: '203B3B' })] }),
        makeTable(['Member', 'Role', 'Entries', 'Completed', 'In progress', 'Completion'], performanceRows.length ? performanceRows : [['—', '—', '0', '0', '0', '0%']], [4698, 2000, 1600, 1600, 1600, 3900]),
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 100 }, children: [new TextRun({ text: isSupervisor ? `Task details — ${taskScope}` : 'Your task details', bold: true, size: 24, color: '203B3B' })] }),
        makeTable(['Date / time', 'Department', 'Problem', 'Action taken', 'Status', 'Notes & supervisor feedback'], taskRows, [1300, 1750, 4000, 2500, 1300, 4548]),
      ],
    }],
  });

  return Packer.toBlob(document);
}
