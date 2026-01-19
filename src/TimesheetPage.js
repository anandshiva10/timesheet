import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isMonday, isSunday } from 'date-fns';
import './TimesheetPage.css';

const CATEGORIES = ['project', 'MS', 'Training', 'certification', 'Holiday'];
const EFFORT_TYPES = ['billable', 'nonbillable'];
const STORAGE_KEY = 'timesheet_entries';

const TimesheetPage = () => {
    const [entries, setEntries] = useState([]);
    const [editId, setEditId] = useState(null);
    const [showSummary, setShowSummary] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        task: '',
        description: '',
        category: 'project',
        effort_type: 'billable',
        hours: ''
    });

    const showResetReminder = useMemo(() => {
        const today = new Date();
        return (isMonday(today) || isSunday(today)) && entries.length > 0;
    }, [entries]);

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const allEntries = saved ? JSON.parse(saved) : [];
            const sorted = allEntries.sort((a, b) => a.date.localeCompare(b.date));
            setEntries(sorted);
        } catch (error) {
            console.error('Error fetching entries:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-select effort type
            if (name === 'category') {
                if (['project', 'MS'].includes(value)) {
                    newData.effort_type = 'billable';
                } else if (['Training', 'certification', 'Holiday'].includes(value)) {
                    newData.effort_type = 'nonbillable';
                }
            }

            return newData;
        });
    };

    const updateStorageEntry = (entry) => {
        const saved = localStorage.getItem(STORAGE_KEY);
        let allEntries = saved ? JSON.parse(saved) : [];

        if (editId) {
            allEntries = allEntries.map(e => e.id === editId ? entry : e);
        } else {
            allEntries.push(entry);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.task || !formData.date || !formData.hours) {
            alert('Please fill in required fields');
            return;
        }

        try {
            const newEntry = {
                id: editId || crypto.randomUUID(),
                task: formData.task,
                description: formData.description,
                category: formData.category,
                effort_type: formData.effort_type,
                date: formData.date,
                hours: parseFloat(formData.hours),
                created_at: new Date().toISOString()
            };

            updateStorageEntry(newEntry);

            // Reset form
            setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                task: '',
                description: '',
                category: 'project',
                effort_type: 'billable',
                hours: ''
            });
            setEditId(null);
            fetchEntries();
        } catch (error) {
            console.error('Error saving entry:', error);
            alert('Error saving entry');
        }
    };

    const handleEdit = (entry) => {
        setEditId(entry.id);
        setFormData({
            date: entry.date,
            task: entry.task,
            description: entry.description || '',
            category: entry.category,
            effort_type: entry.effort_type,
            hours: entry.hours
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditId(null);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            task: '',
            description: '',
            category: 'project',
            effort_type: 'billable',
            hours: ''
        });
    };

    const handleDelete = (e, id) => {
        e.stopPropagation(); // Prevent triggering edit
        if (window.confirm('Are you sure you want to delete this entry?')) {
            const saved = localStorage.getItem(STORAGE_KEY);
            let allEntries = saved ? JSON.parse(saved) : [];
            allEntries = allEntries.filter(entry => entry.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));
            fetchEntries();
        }
    };

    const handleResetAndExport = () => {
        if (entries.length === 0) {
            alert("No data to export");
            return;
        }

        if (!window.confirm("This will download your data and CLEAR the timesheet. Are you sure?")) {
            return;
        }

        // Generate CSV
        const headers = ["Day", "Date", "Task", "Description", "Category", "Effort", "Hours"];
        const rows = entries.map(e => [
            format(parseISO(e.date), 'EEEE'),
            e.date,
            `"${e.task.replace(/"/g, '""')}"`, // Escape quotes
            `"${(e.description || '').replace(/"/g, '""')}"`,
            e.category,
            e.effort_type,
            e.hours
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const startDate = entries[0].date;
        const endDate = entries[entries.length - 1].date;
        link.setAttribute("download", `timesheet_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clear Storage
        localStorage.removeItem(STORAGE_KEY);
        setEntries([]);
    };

    const summary = useMemo(() => {
        let total = 0;
        let billable = 0;
        let nonBillable = 0;
        const billableCategories = {};
        const nonBillableCategories = {};

        entries.forEach(e => {
            const h = parseFloat(e.hours) || 0;
            total += h;
            if (e.effort_type === 'billable') {
                billable += h;
                billableCategories[e.category] = (billableCategories[e.category] || 0) + h;
            } else {
                nonBillable += h;
                nonBillableCategories[e.category] = (nonBillableCategories[e.category] || 0) + h;
            }
        });

        return { total, billable, nonBillable, billableCategories, nonBillableCategories };
    }, [entries]);

    const groupedEntries = useMemo(() => {
        const groups = {};
        entries.forEach(entry => {
            if (!groups[entry.date]) {
                groups[entry.date] = {
                    date: entry.date,
                    totalHours: 0,
                    items: []
                };
            }
            groups[entry.date].items.push(entry);
            groups[entry.date].totalHours += parseFloat(entry.hours) || 0;
        });

        // Convert to array and sort by date
        return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
    }, [entries]);

    const handleCopySummary = () => {
        let text = `Weekly Timesheet Summary\n`;
        text += `------------------------\n\n`;

        text += `Billable: ${summary.billable}h\n`;
        Object.entries(summary.billableCategories).forEach(([cat, hours]) => {
            text += `  ${cat}: ${hours}h\n`;
        });

        text += `\nNon-Billable: ${summary.nonBillable}h\n`;
        Object.entries(summary.nonBillableCategories).forEach(([cat, hours]) => {
            text += `  ${cat}: ${hours}h\n`;
        });

        text += `\n------------------------\n`;
        text += `Total: ${summary.total}h\n`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Summary copied to clipboard!');
        });
    };

    return (
        <div className="timesheet-container">
            <h1 className="app-title">Nehu's time sheets</h1>

            {showResetReminder && (
                <div className="monday-reminder">
                    👋 It's Sunday/Monday! Don't forget to <strong>Reset & Export</strong> your data for the new week.
                </div>
            )}

            <div className="header-controls">
                <div className="summary-stats">
                    <div className="stat-item">
                        <span className="stat-label">Total</span>
                        <span className="stat-value">{summary.total}h</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Billable</span>
                        <span className="stat-value">{summary.billable}h</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Non-Billable</span>
                        <span className="stat-value">{summary.nonBillable}h</span>
                    </div>
                </div>

                <div className="header-actions">
                    <button onClick={() => setShowSummary(true)} className="summary-btn" title="View Summary">
                        📊 Summarize
                    </button>
                    <button onClick={handleResetAndExport} className="reset-btn" title="Download & Reset">
                        ⚠️ Reset & Export CSV
                    </button>
                </div>
            </div>

            <form className="entry-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Date</label>
                    <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Task</label>
                    <input
                        type="text"
                        name="task"
                        placeholder="Task Name"
                        value={formData.task}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        name="description"
                        placeholder="Details..."
                        value={formData.description}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="form-group">
                    <label>Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Effort (Auto-selected)</label>
                    <select
                        name="effort_type"
                        value={formData.effort_type}
                        disabled
                        className="disabled-select"
                    >
                        {EFFORT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Hours</label>
                    <input
                        type="number"
                        name="hours"
                        step="0.5"
                        placeholder="0.0"
                        value={formData.hours}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="add-btn">
                        {editId ? 'Update Entry' : 'Add Entry'}
                    </button>
                    {editId && (
                        <button type="button" className="cancel-btn" onClick={handleCancelEdit}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            <div className="entries-list">
                {groupedEntries.length === 0 ? (
                    <div className="no-entries">No entries for this week. Add one above!</div>
                ) : (
                    groupedEntries.map(group => (
                        <div key={group.date} className="date-group">
                            <div className="date-group-header">
                                <span className="group-date">
                                    {format(parseISO(group.date), 'EEEE, MMM do')}
                                </span>
                                <span className="group-day-total">
                                    {group.totalHours}h
                                </span>
                            </div>
                            <div className="date-group-items">
                                {group.items.map(entry => (
                                    <div
                                        key={entry.id}
                                        className={`entry-row ${entry.effort_type}`}
                                        onClick={() => handleEdit(entry)}
                                    >
                                        <div className="entry-main">
                                            <div className="entry-task">{entry.task}</div>
                                            <div className="entry-desc">{entry.description}</div>
                                        </div>
                                        <div className="entry-meta">
                                            <span className="tag category">{entry.category}</span>
                                            <span className="tag effort">{entry.effort_type}</span>
                                        </div>
                                        <div className="entry-hours">
                                            {entry.hours}h
                                        </div>
                                        <button
                                            className="delete-btn"
                                            onClick={(e) => handleDelete(e, entry.id)}
                                            title="Delete Entry"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showSummary && (
                <div className="modal-overlay" onClick={() => setShowSummary(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Weekly Summary</h2>

                        <div className="summary-list-container">
                            {/* Billable Section */}
                            <div className="summary-group">
                                <div className="group-header billable-header">
                                    <h3>Billable</h3>
                                    <span className="group-total">{summary.billable}h</span>
                                </div>
                                <div className="group-list">
                                    {Object.entries(summary.billableCategories).map(([cat, hours]) => (
                                        <div key={cat} className="group-item">
                                            <span>{cat}</span>
                                            <span>{hours}h</span>
                                        </div>
                                    ))}
                                    {Object.keys(summary.billableCategories).length === 0 && (
                                        <div className="empty-group">No billable hours</div>
                                    )}
                                </div>
                            </div>

                            {/* Non-Billable Section */}
                            <div className="summary-group">
                                <div className="group-header non-billable-header">
                                    <h3>Non-Billable</h3>
                                    <span className="group-total">{summary.nonBillable}h</span>
                                </div>
                                <div className="group-list">
                                    {Object.entries(summary.nonBillableCategories).map(([cat, hours]) => (
                                        <div key={cat} className="group-item">
                                            <span>{cat}</span>
                                            <span>{hours}h</span>
                                        </div>
                                    ))}
                                    {Object.keys(summary.nonBillableCategories).length === 0 && (
                                        <div className="empty-group">No non-billable hours</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="total-footer">
                            <span>Total Hours</span>
                            <strong>{summary.total}h</strong>
                        </div>

                        <div className="modal-actions">
                            <button className="copy-btn" onClick={handleCopySummary}>
                                📋 Copy
                            </button>
                            <button className="close-modal-btn" onClick={() => setShowSummary(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimesheetPage;
