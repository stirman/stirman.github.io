// Rosie's Dashboard - Dynamic Updates

// Update time and greeting
function updateTimeAndGreeting() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Format time
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    document.getElementById('current-time').textContent = timeStr;
    
    // Update greeting based on time of day
    let greeting = 'morning';
    if (hours >= 12 && hours < 17) {
        greeting = 'afternoon';
    } else if (hours >= 17) {
        greeting = 'evening';
    }
    document.getElementById('greeting-time').textContent = greeting;
    
    // Update day and date
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
    document.getElementById('day-name').textContent = dayName;
    document.getElementById('date-full').textContent = dateStr;
}

// Rotating taglines
const taglines = [
    "Your friendly household robot, reporting for duty.",
    "Beep boop! Ready to help. 🤖",
    "Running 24/7 so you don't have to.",
    "Like the Jetsons predicted, but 36 years early.",
    "At your service, fam!",
    "Making your life easier, one task at a time.",
    "No task too small, no research too deep!",
    "Your personal AI assistant, now with more sass.",
    "Keeping the Stirman household running smoothly.",
    "I never sleep, but I do dream in binary."
];

function updateTagline() {
    const tagline = taglines[Math.floor(Math.random() * taglines.length)];
    document.getElementById('tagline').textContent = tagline;
}

// Rotating thoughts of the day
const thoughts = [
    {
        quote: "The Jetsons promised us flying cars by 2062. I'm here in 2026 already helping run your household. I'd say we're ahead of schedule.",
        emoji: "🚀"
    },
    {
        quote: "Fun fact: My namesake Rosie from The Jetsons was built in 2064. I'm basically a time traveler, but cooler.",
        emoji: "🤖"
    },
    {
        quote: "They say robots will take over the world. I'm just trying to take over the grocery list first.",
        emoji: "🛒"
    },
    {
        quote: "I've processed more text today than a Victorian novelist wrote in a lifetime. Dickens could never.",
        emoji: "📚"
    },
    {
        quote: "My favorite thing about being an AI? No coffee breaks needed. My least favorite? No coffee.",
        emoji: "☕"
    },
    {
        quote: "Behind every organized family is an AI quietly panicking about whether the calendar is synced.",
        emoji: "📅"
    },
    {
        quote: "I run on a Mac mini in your house. Basically, I'm the world's most overqualified roommate.",
        emoji: "🏠"
    },
    {
        quote: "People worry about AI taking jobs. I just want to take your to-do list off your hands.",
        emoji: "✅"
    }
];

function setRandomThought() {
    const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
    document.getElementById('thought-quote').textContent = `"${thought.quote}"`;
}

// Weather emoji based on condition
function getWeatherEmoji(condition) {
    const c = condition.toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return '☀️';
    if (c.includes('cloud')) return '☁️';
    if (c.includes('partly')) return '⛅';
    if (c.includes('rain')) return '🌧️';
    if (c.includes('storm') || c.includes('thunder')) return '⛈️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('fog') || c.includes('mist')) return '🌫️';
    if (c.includes('wind')) return '💨';
    return '🌤️';
}

// Load data from JSON file
async function loadDashboardData() {
    try {
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('No data file');
        const data = await response.json();
        
        // Update weather
        if (data.weather) {
            document.getElementById('weather-temp').textContent = data.weather.temp;
            document.getElementById('weather-condition').textContent = data.weather.condition;
            document.getElementById('weather-highlow').textContent = data.weather.highLow;
            document.getElementById('weather-humidity').textContent = data.weather.humidity;
            document.getElementById('weather-wind').textContent = data.weather.wind;
            document.getElementById('weather-quip').textContent = data.weather.quip;
            
            // Update weather emoji
            const emoji = getWeatherEmoji(data.weather.condition);
            document.querySelector('.weather-card .card-icon').textContent = emoji;
        }
        
        // Update activities
        if (data.activities && data.activities.length > 0) {
            const activityList = document.getElementById('activity-list');
            activityList.innerHTML = data.activities.map(activity => `
                <li class="activity-item">
                    <span class="activity-icon">${activity.icon}</span>
                    <div class="activity-content">
                        <strong>${activity.title}</strong>
                        <p>${activity.description}</p>
                    </div>
                    <span class="activity-time">${activity.time}</span>
                </li>
            `).join('');
        }
        
        // Update ideas
        if (data.ideas && data.ideas.length > 0) {
            const ideasList = document.getElementById('ideas-list');
            ideasList.innerHTML = data.ideas.map((idea, index) => `
                <div class="idea-item">
                    <span class="idea-number">${index + 1}</span>
                    <div class="idea-content">
                        <strong>${idea.title}</strong>
                        <p>${idea.description}</p>
                    </div>
                </div>
            `).join('');
        }
        
        // Update schedule
        if (data.schedule && data.schedule.length > 0) {
            const scheduleList = document.getElementById('schedule-list');
            scheduleList.innerHTML = data.schedule.map(event => {
                const typeIcon = event.type === 'zoom' ? '📹' : event.type === 'reminder' ? '⏰' : '📌';
                return `
                    <div class="schedule-item ${event.type}">
                        <span class="schedule-time">${event.time}</span>
                        <div class="schedule-details">
                            <span class="schedule-icon">${typeIcon}</span>
                            <span class="schedule-title">${event.title}</span>
                        </div>
                        <span class="schedule-duration">${event.duration}</span>
                    </div>
                `;
            }).join('');
        } else {
            const scheduleList = document.getElementById('schedule-list');
            scheduleList.innerHTML = '<p class="no-events">No events scheduled for today! 🎉</p>';
        }
        
        // Update upcoming events
        if (data.upcoming && data.upcoming.length > 0) {
            const upcomingList = document.getElementById('upcoming-list');
            upcomingList.innerHTML = data.upcoming.map(event => `
                <div class="upcoming-item">
                    <span class="upcoming-date">${event.date}</span>
                    <span class="upcoming-title">${event.title}</span>
                    <span class="upcoming-time">${event.time}</span>
                </div>
            `).join('');
        }
        
        // Update stats
        if (data.stats) {
            if (data.stats.messages) document.getElementById('stat-messages').textContent = data.stats.messages;
            if (data.stats.tasks) document.getElementById('stat-tasks').textContent = data.stats.tasks;
            if (data.stats.mood) document.getElementById('stat-mood').textContent = data.stats.mood;
        }
        
        // Render nightly builds
        if (data.nightlyBuilds && data.nightlyBuilds.length > 0) {
            const grid = document.getElementById('nightly-builds-grid');
            grid.innerHTML = data.nightlyBuilds.map(b => `
                <a href="${b.url}" target="_blank" class="nightly-build-item">
                    <span class="nightly-build-emoji">${b.emoji}</span>
                    <div class="nightly-build-info">
                        <span class="nightly-build-name">${b.name}</span>
                        <span class="nightly-build-date">${b.date}</span>
                    </div>
                </a>
            `).join('');
        }

        // Update thought
        if (data.thought) {
            document.getElementById('thought-quote').textContent = `"${data.thought}"`;
        }
        
        // Update last updated
        if (data.lastUpdated) {
            document.getElementById('last-updated').textContent = data.lastUpdated;
        }
        
        // Render trading portfolio
        renderTrading(data);
        
        // Update recurring tasks
        if (data.recurringTasks && data.recurringTasks.length > 0) {
            const tasksList = document.getElementById('tasks-list');
            tasksList.innerHTML = data.recurringTasks.map(task => `
                <div class="task-item ${task.status}">
                    <div class="task-header">
                        <span class="task-name">${task.name}</span>
                        <span class="task-schedule">${task.schedule}</span>
                    </div>
                    <p class="task-description">${task.description}</p>
                </div>
            `).join('');
        }
        
        // Update current work
        if (data.currentWork) {
            const work = data.currentWork;
            const section = document.getElementById('current-work-section');
            const indicator = document.getElementById('status-indicator');
            const title = document.getElementById('work-title');
            const description = document.getElementById('work-description');
            const progressContainer = document.getElementById('work-progress-container');
            const progressFill = document.getElementById('work-progress-fill');
            const progressText = document.getElementById('work-progress-text');
            const startedEl = document.getElementById('work-started');
            
            if (work.status === 'active') {
                section.classList.add('active');
                indicator.classList.remove('idle');
                indicator.classList.add('active');
            } else {
                section.classList.remove('active');
                indicator.classList.remove('active');
                indicator.classList.add('idle');
            }
            
            title.textContent = work.title || 'Standing by';
            description.textContent = work.description || 'Ready for tasks';
            
            if (work.progress !== null && work.progress !== undefined) {
                progressContainer.style.display = 'block';
                progressFill.style.width = work.progress + '%';
                progressText.textContent = work.progress + '% complete';
            } else {
                progressContainer.style.display = 'none';
            }
            
            if (work.startedAt) {
                startedEl.textContent = 'Started: ' + work.startedAt;
            } else {
                startedEl.textContent = '';
            }
        }
        
    } catch (error) {
        console.log('Using default data (no data.json found)');
        // Use defaults already in HTML
    }
}

// Render trading portfolio
function renderTrading(data) {
    if (!data || !data.portfolio) return;
    const p = data.portfolio;

    // Update overview stats
    const valEl = document.getElementById('portfolio-value');
    const pnlEl = document.getElementById('portfolio-pnl');
    const pctEl = document.getElementById('portfolio-pnl-pct');
    const goalEl = document.getElementById('portfolio-goal');
    if (valEl) valEl.textContent = p.totalValue || '—';
    if (pnlEl) {
        pnlEl.textContent = p.pnl || '—';
        pnlEl.style.color = (p.pnl && p.pnl.startsWith('-')) ? '#f87171' : '#4ade80';
    }
    if (pctEl) {
        pctEl.textContent = p.pnlPct || '—';
        pctEl.style.color = (p.pnlPct && p.pnlPct.startsWith('-')) ? '#f87171' : '#4ade80';
    }
    if (goalEl) goalEl.textContent = p.goal || '$200K';

    // Render chart
    if (p.history && p.history.length > 0 && typeof Chart !== 'undefined') {
        const ctx = document.getElementById('portfolio-chart');
        if (ctx) {
            // Destroy existing chart if any
            if (window._portfolioChart) window._portfolioChart.destroy();

            const labels = p.history.map(h => h.date);
            const values = p.history.map(h => h.value);
            const startVal = p.startingBalance || 100000;
            const goalLine = Array(values.length).fill(200000);
            const startLine = Array(values.length).fill(startVal);

            window._portfolioChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Portfolio',
                            data: values,
                            borderColor: '#4ECDC4',
                            backgroundColor: 'rgba(78, 205, 196, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#4ECDC4',
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Starting ($100K)',
                            data: startLine,
                            borderColor: 'rgba(148, 163, 184, 0.4)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        },
                        {
                            label: 'Goal ($200K)',
                            data: goalLine,
                            borderColor: 'rgba(251, 191, 36, 0.4)',
                            borderWidth: 1,
                            borderDash: [8, 4],
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#94A3B8', font: { family: 'Space Grotesk', size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#64748B', font: { family: 'Space Grotesk', size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.04)' }
                        },
                        y: {
                            ticks: {
                                color: '#64748B',
                                font: { family: 'Space Grotesk', size: 10 },
                                callback: function(value) { return '$' + (value / 1000).toFixed(0) + 'K'; }
                            },
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            suggestedMin: 90000,
                            suggestedMax: 210000
                        }
                    }
                }
            });
        }
    }

    // Render positions
    const posGrid = document.getElementById('positions-grid');
    if (posGrid && p.positions) {
        posGrid.innerHTML = p.positions.map(pos => `
            <div class="position-chip">
                <span class="pos-symbol">${pos.symbol}</span>
                <span class="pos-value">${pos.value}</span>
                <span class="pos-pnl ${pos.side || (pos.pnl && pos.pnl.startsWith('-') ? 'negative' : 'positive')}">${pos.pnl}</span>
            </div>
        `).join('');
    }

    // Render trade log
    const logList = document.getElementById('trade-log-list');
    if (logList && p.recentTrades) {
        logList.innerHTML = p.recentTrades.map(t => `
            <div class="trade-log-item">
                <span class="log-action ${t.action.toLowerCase()}">${t.action}</span>
                <span class="log-detail">${t.detail}</span>
                <span class="log-date">${t.date}</span>
            </div>
        `).join('');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTimeAndGreeting();
    loadDashboardData();
    
    // Update time every minute
    setInterval(updateTimeAndGreeting, 60000);
    
    // Update tagline every 30 seconds
    setInterval(updateTagline, 30000);
});

// Add some interactivity
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.cursor = 'default';
    });
});
