import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isMonday } from 'date-fns';
import './TimesheetPage.css';

const CATEGORIES = ['project', 'MS', 'Training', 'certification'];
const EFFORT_TYPES = ['billable', 'nonbillable'];
const STORAGE_KEY = 'timesheet_entries';

const TimesheetPage = () => {
    const [entries, setEntries] = useState([]);
    const [editId, setEditId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        task: '',
        description: '',
        category: 'project',
        effort_type: 'billable',
        hours: ''
    });

    const showMondayReminder = useMemo(() => {
        return isMonday(new Date()) && entries.length > 0;
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
                } else if (['Training', 'certification'].includes(value)) {
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
        link.setAttribute("download", `timesheet_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
        const categoryTotals = {};

        entries.forEach(e => {
            const h = parseFloat(e.hours) || 0;
            total += h;
            if (e.effort_type === 'billable') billable += h;
            else nonBillable += h;

            categoryTotals[e.category] = (categoryTotals[e.category] || 0) + h;
        });

        return { total, billable, nonBillable, categoryTotals };
    }, [entries]);

    return (
        <div className="timesheet-container">
            <h1 className="app-title">Nehu's time sheets</h1>

            {showMondayReminder && (
                <div className="monday-reminder">
                    👋 It's Monday! Don't forget to <strong>Reset & Export</strong> last week's data if you haven't already.
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

                <button onClick={handleResetAndExport} className="reset-btn" title="Download & Reset">
                    ⚠️ Reset & Export CSV
                </button>
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
                    <label>Effort</label>
                    <select name="effort_type" value={formData.effort_type} onChange={handleInputChange}>
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
                {entries.length === 0 ? (
                    <div className="no-entries">No entries for this week. Add one above!</div>
                ) : (
                    entries.map(entry => (
                        <div
                            key={entry.id}
                            className={`entry-row ${entry.effort_type}`}
                            onClick={() => handleEdit(entry)}
                        >
                            <div className="entry-day">
                                {format(parseISO(entry.date), 'EEEE')}
                                <span className="entry-date-small">{entry.date}</span>
                            </div>
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
                    ))
                )}
            </div>
        </div>
    );
};

export default TimesheetPage;
