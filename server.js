import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { callGeminiAPI, buildSummarizePrompt, buildAskPrompt } from './gemini-integration.js';
import Project from './models/Project.js';
import Task from './models/Task.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;



mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());


app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = new Project({
      name,
      description,
      userId: new mongoose.Types.ObjectId(), 
    });
    const savedProject = await project.save();
    res.status(201).json(savedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
  
    await Task.deleteMany({ projectId: req.params.id });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.get('/api/tasks/:projectId', async (req, res) => {
  try {
    const projectTasks = await Task.find({ projectId: req.params.projectId }).sort({ position: 1 });
    res.json(projectTasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { projectId, title, description, status, position } = req.body;

    const task = new Task({
      projectId,
      title,
      description,
      status,
      position,
    });
    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        title: title ?? undefined,
        description: description ?? undefined,
        status: status ?? undefined,
      },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || tasks.length === 0) {
      return res.json({
        summary: 'No tasks available to summarize.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      const todoTasks = tasks.filter(t => t.status === 'todo').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const doneTasks = tasks.filter(t => t.status === 'done').length;

      const summary = `Project Summary:

Total Tasks: ${tasks.length}
- To Do: ${todoTasks} tasks
- In Progress: ${inProgressTasks} tasks
- Done: ${doneTasks} tasks

Progress: ${Math.round((doneTasks / tasks.length) * 100)}% complete

Top Priority Tasks:
${tasks.filter(t => t.status === 'todo').slice(0, 3).map((t, i) => `${i + 1}. ${t.title}`).join('\n')}`;

      return res.json({ summary });
    }
    const prompt = buildSummarizePrompt(tasks);
    const summary = await callGeminiAPI(prompt, apiKey);
    
    res.json({ summary });
  } catch (error) {  
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.post('/api/ai/ask', async (req, res) => {
  try {
    const { tasks, question } = req.body;

    if (!tasks || tasks.length === 0) {
      return res.json({
        answer: 'There are no tasks in this project yet.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      const todoTasks = tasks.filter(t => t.status === 'todo').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const doneTasks = tasks.filter(t => t.status === 'done').length;

      let answer = `Based on your project data:\n\n`;

      if (question.toLowerCase().includes('how many')) {
        answer += `Total: ${tasks.length} tasks\n`;
        answer += `- To Do: ${todoTasks}\n`;
        answer += `- In Progress: ${inProgressTasks}\n`;
        answer += `- Done: ${doneTasks}`;
      } else if (question.toLowerCase().includes('progress')) {
        const progress = Math.round((doneTasks / tasks.length) * 100);
        answer += `Your project is ${progress}% complete with ${doneTasks} out of ${tasks.length} tasks finished.`;
      } else {
        answer += `I found ${tasks.length} tasks in your project. ${todoTasks} are pending, ${inProgressTasks} are in progress, and ${doneTasks} are completed.`;
      }

      answer += '\n\nNote: This is a demo response. Add your GEMINI_API_KEY in server/.env to get AI-powered answers.';

      return res.json({ answer });
    }

    const prompt = buildAskPrompt(tasks, question);
    const answer = await callGeminiAPI(prompt, apiKey);
    
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process question' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
