import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isMonday, isSunday } from 'date-fns';
import './TimesheetPage.css';

const CATEGORIES = ['Project', 'MS', 'Training', 'Certification', 'Holiday'];
const EFFORT_TYPES = ['Billable', 'Non-Billable'];
const STORAGE_KEY = 'timesheet_entries';
const TRIAGE_STORAGE_KEY = 'triage_shifts';

const TimesheetPage = () => {
    const [entries, setEntries] = useState([]);
    const [editId, setEditId] = useState(null);
    const [showSummary, setShowSummary] = useState(false);

    // Triage State
    const [triageEntries, setTriageEntries] = useState([]);
    const [showTriageForm, setShowTriageForm] = useState(false);
    const [triageFormData, setTriageFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        shiftType: 's1'
    });

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
        fetchTriageEntries();
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

    const fetchTriageEntries = () => {
        try {
            const saved = localStorage.getItem(TRIAGE_STORAGE_KEY);
            const all = saved ? JSON.parse(saved) : [];
            // Sort by date desc
            const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
            setTriageEntries(sorted);
        } catch (error) {
            console.error('Error fetching triage entries:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-select effort type
            if (name === 'category') {
                if (['Project', 'MS'].includes(value)) {
                    newData.effort_type = 'Billable';
                } else if (['Training', 'Certification', 'Holiday'].includes(value)) {
                    newData.effort_type = 'Non-Billable';
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
        if (window.confirm('Anthey na? Fix ah??')) {
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
            // Case-insensitive check or check for both Title Case and lowercase for backward compatibility
            if (e.effort_type === 'Billable' || e.effort_type === 'billable') {
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

    // Triage Handlers
    const handleTriageInputChange = (e) => {
        const { name, value } = e.target;
        setTriageFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTriageSubmit = (e) => {
        e.preventDefault();
        if (!triageFormData.date || !triageFormData.shiftType) return;

        const newEntry = {
            id: crypto.randomUUID(),
            date: triageFormData.date,
            shiftType: triageFormData.shiftType,
            createdAt: new Date().toISOString()
        };

        const updated = [newEntry, ...triageEntries];
        // Sort again just in case
        updated.sort((a, b) => b.date.localeCompare(a.date));

        setTriageEntries(updated);
        localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(updated));

        // Reset form
        setTriageFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            shiftType: 's1'
        });
        setShowTriageForm(false);
    };

    const handleDeleteTriage = (id) => {
        if (window.confirm('Delete this shift log?')) {
            const updated = triageEntries.filter(e => e.id !== id);
            setTriageEntries(updated);
            localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(updated));
        }
    };

    const handleClearAllTriage = () => {
        if (triageEntries.length === 0) return;
        if (window.confirm('Are you sure you want to clear ALL triage shifts? This cannot be undone.')) {
            setTriageEntries([]);
            localStorage.removeItem(TRIAGE_STORAGE_KEY);
        }
    };

    return (
        <div className="timesheet-container">
            <h1 className="app-title">Nehu's time sheets</h1>

            {showResetReminder && (
                <div className="monday-reminder">
                    Monday ivaala! <strong>Reset chey timesheet...</strong> Ledhantey data assam aithadii.
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
                            {group.totalHours > 8 && (
                                <div className="overtime-warning">
                                    uko uko.. konchem takkuva pani chey
                                </div>
                            )}
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

            {/* Triage Shifts Section */}
            <div className="triage-section">
                <hr className="section-divider" />
                <div className="triage-header">
                    <h2>Triage Shifts</h2>
                    <div className="triage-actions">
                        <button
                            className="clear-triage-btn"
                            onClick={handleClearAllTriage}
                            disabled={triageEntries.length === 0}
                            title="Clear All Triage Shifts"
                        >
                            Clear All
                        </button>
                        <button
                            className="log-shift-btn"
                            onClick={() => setShowTriageForm(!showTriageForm)}
                        >
                            {showTriageForm ? 'Cancel Log' : 'Log Shift'}
                        </button>
                    </div>
                </div>

                {showTriageForm && (
                    <form className="triage-form" onSubmit={handleTriageSubmit}>
                        <div className="form-group">
                            <label>Date</label>
                            <input
                                type="date"
                                name="date"
                                value={triageFormData.date}
                                onChange={handleTriageInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Shift Type</label>
                            <select
                                name="shiftType"
                                value={triageFormData.shiftType}
                                onChange={handleTriageInputChange}
                            >
                                <option value="s1">s1</option>
                                <option value="s2">s2</option>
                                <option value="s3">s3</option>
                            </select>
                        </div>
                        <button type="submit" className="save-shift-btn">
                            Save Shift
                        </button>
                    </form>
                )}

                <div className="triage-list">
                    {triageEntries.length === 0 ? (
                        <p className="no-triage">No triage shifts logged yet.</p>
                    ) : (
                        <table className="triage-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Shift Type</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {triageEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>{entry.date}</td>
                                        <td>{entry.shiftType}</td>
                                        <td>
                                            <button
                                                className="delete-triage-btn"
                                                onClick={() => handleDeleteTriage(entry.id)}
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
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
