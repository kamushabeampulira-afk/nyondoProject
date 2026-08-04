# 🏪 Nyondo Business Management System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-5.x-blue)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen)](https://mongoosejs.com/)
[![License](https://img.shields.io/badge/License-Educational-purple)]()

## 📌 Overview

**Nyondo** is a full-stack business management web application designed to help small and medium-sized businesses manage their daily operations from one centralized platform.

The system provides tools for managing inventory, customers, suppliers, sales, deposits, payments, and business reports while providing secure authentication and role-based access control.

The goal of Nyondo is to reduce manual record keeping, improve stock visibility, and provide business owners with accurate information for better decision-making.

---

## 🚀 Features

### 🔐 Authentication & User Management

* Secure user login system
* Role-based access control
* Different permissions for administrators, managers, and staff
* User account management

### 📊 Dashboard & Reporting

* Business performance overview
* Key performance indicators (KPIs)
* Sales summaries
* Inventory insights
* Business reports generation

### 📦 Inventory Management

* Product management
* Stock tracking
* Stock movement records
* Low-stock monitoring
* Inventory updates

### 👥 Customer & Supplier Management

* Customer records management
* Supplier information tracking
* Supplier credit management
* Payment tracking

### 💰 Sales & Payments

* Sales processing
* Payment recording
* Receipt generation
* Invoice management

### 🏦 Deposit Scheme Management

* Customer deposit registration
* Deposit transaction tracking
* Deposit balance monitoring

---

# 🛠️ Technology Stack

## Backend

* **Node.js** - JavaScript runtime environment
* **Express.js** - Web application framework
* **MongoDB** - NoSQL database
* **Mongoose** - MongoDB object modeling
* **Passport.js** - Authentication middleware
* **PDFKit** - Receipt and document generation

## Frontend

* **Pug Templates** - Server-side rendered views
* **HTML/CSS/JavaScript**
* Responsive dashboard interface

---

# 🏗️ Application Architecture

The project follows a structured MVC-style architecture:

```
nyondoProject/
│
├── config/          # Database and application configuration
├── middleware/      # Authentication and authorization middleware
├── models/          # MongoDB schemas and data models
├── routes/          # Application endpoints
├── public/          # Static files (CSS, JavaScript, images)
├── utils/           # Helper functions and utilities
├── views/           # Pug templates
│
└── server.js        # Application entry point
```

---

# 📋 Prerequisites

Before running the project, ensure you have:

* Node.js version 18 or higher
* npm package manager
* MongoDB database (local or cloud instance)

---

# ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>

cd nyondoProject
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000

MONGO_URI=mongodb://127.0.0.1:27017/nyondoProject

SESSION_SECRET=your-session-secret

ADMIN_EMAIL=admin@nyondo.com

ADMIN_PASSWORD=Admin123!

SESSION_COOKIE_SECURE=false

SESSION_COOKIE_SAMESITE=lax
```

⚠️ **Important:** Never commit your `.env` file to GitHub. Keep sensitive credentials private.

---

# ▶️ Running the Application

Start the development server:

```bash
npm start
```

Open your browser and visit:

```
http://localhost:3000
```

---

# 🔑 Default Admin Account

On the first application startup, the system automatically creates an administrator account if no users exist.

```
Email: admin@nyondo.com

Password: Admin123!
```

For security reasons, change the password after your first login.

---

# 📸 Screenshots

Add screenshots demonstrating the main features:

Example:

```md
![Dashboard](./images/dashboard.png)

![Inventory Management](./images/inventory.png)

![Sales Management](./images/sales.png)
```

Recommended screenshots:

* Login page
* Dashboard
* Inventory management
* Sales page
* Reports section

---

# 🔒 Security Considerations

The application includes:

* Authentication middleware
* Session-based user authentication
* Role-based permissions
* Environment variable protection
* Secure password handling

For production deployment:

* Use a managed MongoDB database
* Enable secure cookies
* Use stronger session secrets
* Configure HTTPS

---

# 🌱 Future Improvements

Possible future enhancements:

* Mobile application support
* Online payment integration
* Advanced analytics dashboard
* Cloud deployment
* Automated inventory forecasting
* Email and SMS notifications

---

# 🤝 Contributing

Contributions are welcome.

If you would like to improve this project:

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push your branch

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

# 📄 License

This project is developed for educational purposes as part of **Refactory Academy software engineering training**.

---

## 👨‍💻 Author

**Kamushabe Ampulira**

Software Engineering Student
Passionate about building practical solutions through technology.
