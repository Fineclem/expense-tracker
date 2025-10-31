# Expense Tracker

A modern, full-featured expense tracking application built with Node.js, Express, and SQLite.

## Features

- 🔐 **User Authentication** - Secure signup and login with JWT tokens
- 💰 **Expense Management** - Add, edit, and delete expenses with categories
- 📊 **Budget Tracking** - Set daily, weekly, and monthly budget limits
- 📈 **Reports & Analytics** - View spending patterns with interactive charts
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🎨 **Modern UI** - Beautiful, intuitive interface with smooth animations

## Project Structure

```
expense-tracker/
├── src/
│   ├── controllers/     # API route handlers
│   │   ├── authController.js
│   │   ├── budgetController.js
│   │   ├── expenseController.js
│   │   └── reportController.js
│   ├── middleware/      # Authentication middleware
│   │   └── auth.js
│   ├── models/          # Database models
│   │   ├── budgetModel.js
│   │   ├── expenseModel.js
│   │   ├── reportModel.js
│   │   └── userModel.js
│   ├── routes/          # API routes
│   │   ├── auth.js
│   │   ├── budget.js
│   │   ├── expenses.js
│   │   └── reports.js
│   ├── config/          # Configuration files
│   │   └── database.js
│   └── app.js           # Main application file
├── public/              # Static files
│   ├── css/            # Stylesheets
│   ├── js/             # Client-side JavaScript
│   └── pages/          # HTML pages
├── data/               # Database files
├── .env                # Environment variables
└── package.json        # Dependencies and scripts
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expense-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:4001`

## Environment Variables

Create a `.env` file in the root directory:



## API Endpoints

### Authentication
Create new user account- User login
 Get current user info

### Expenses
 Add new expense
 Get user's expenses
 Update expense
 Delete expense

### Budget
 Get user's budget settings
 Update budget settings

### Reports
- Get spending reports

## Database Schema

The application uses SQLite with the following tables:

- **users** - User accounts and authentication
- **expenses** - Individual expense records
- **budgets** - User budget settings

## Technologies Used

- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing
- **Development**: nodemon for auto-reload

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
