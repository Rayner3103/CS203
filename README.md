**Total:**
[![codecov](https://codecov.io/github/tyxyx/tariff/graph/badge.svg?token=6XH81GKBNP)](https://codecov.io/github/tyxyx/tariff)
|
**Backend:** 
[![Backend Coverage](https://codecov.io/gh/tyxyx/tariff/branch/main/graph/badge.svg?flag=backend )](https://codecov.io/github/tyxyx/tariff)
|
**Frontend:** 
[![Frontend Coverage](https://codecov.io/gh/tyxyx/tariff/branch/main/graph/badge.svg?flag=frontend )](https://codecov.io/github/tyxyx/tariff)


# TARIFF  
**Trade Agreements Regulating Imports and Foreign Fees**

**Demo: http://104.208.65.235:3000/**

## 📌 Project Vision  
TARIFF is a system designed to manage and calculate **import tariffs and fees** based on a product's **country of origin/destination, brand, price, and category**.  
It is tailored for the **Technology Sector**, focusing on trade-related data management and tariff calculations.  

---

## 🌐 Target Industry & Scope  
- **Industry Focus**: Technology Sector  
- **Product Categories**:  
  - Semiconductors  
  - Laptops  
  - Smartphones  
  - Solid-State Drives (SSDs)  
  - Graphics Processing Units (GPUs)  

---

## 👥 User Roles  

### **Admin**  
- Manage tariff data (add, remove, modify tariff rates).  
- Access to full CRUD operations on tariffs.  

### **User**  
- Browse, search, and view tariff data.  
- Perform tariff calculations using the calculator tool.  
- Export tariff data and results for further analysis.  

---

## 📄 Key Pages (Baseline Requirements)  

1. **Signup/Login Page**  
   - Authentication system with **hashed password storage**.  
   - Support for multiple user roles (Admin, User).  

2. **Summary Tariff Table**  
   - Central dashboard displaying up-to-date tariff data.  

3. **Calculator Page**  
   - Interactive tool for tariff calculations.  

4. **Update Tariff Page (Admin Only)**  
   - Manage tariff rates (CRUD interface).  

5. **Profile Page**  
   - Manage user account details.  

---

## 🏗️ Technical Architecture  

- **Frontend**: ReactJS  
- **Backend**: Spring Boot (Java) with Swagger UI for API documentation  
- **Database**: PostgreSQL  
- **Deployment**:  
  - **Backend **: AWS EC2
  - Database **: AWS RDS
  - **Frontend **: AWS EC2
  - **Scrapper **: AWS EC2

---

## 🚀 Advanced Features (Stretch Goals)  

- **Data Exportability**  
  - Export tariff data and calculation results in formats such as **CSV**.  
  - Enables further data analysis and storage for reference.  

- **Tariff Change Prediction (AI-Powered)**
  - Users can upload trade-related PDFs (e.g., invoices, agreements, shipment details) directly through the interface.
  - The platform uses machine learning to automatically analyze the uploaded document, predict potential tariff changes or risks, and generate a concise summary of its findings.
  - The prediction summary includes key data, explainable model results, and actionable insights based on historical tariff trends.
---

## ✅ Summary  
TARIFF will provide a **centralized platform** for tariff data management, calculation, and visualization, making it useful for governments, businesses, and analysts in the **tech trade industry**.  

