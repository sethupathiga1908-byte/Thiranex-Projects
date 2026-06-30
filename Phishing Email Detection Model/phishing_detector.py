import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ==========================================
# 1. LOAD AND PREPARE DATA
# ==========================================
# Replace 'emails.csv' with your actual dataset path
try:
    df = pd.read_csv('emails.csv')
except FileNotFoundError:
    # Creating a small dummy dataset for demonstration if file doesn't exist
    print("Real dataset not found. Generating dummy data for demonstration...")
    data = {
        'text': [
            "Dear valued customer, please click here to verify your bank account immediately or face suspension.",
            "Hey, are we still meeting for lunch today at 12 PM?",
            "URGENT: Your Netflix account has been compromised. Update your payment details at http://fake-netflix-login.com",
            "Attached is the project report for Q3. Let me know if you have any feedback.",
            "CONGRATULATIONS! You have won a $1000 Amazon gift card. Click this link to claim your prize now!"
        ],
        'label': [1, 0, 1, 0, 1]  # 1 = Phishing, 0 = Safe
    }
    df = pd.DataFrame(data)

print(f"Dataset Shape: {df.shape}")
print(df['label'].value_counts())

# Split the data into features (X) and target labels (y)
X = df['text']
y = df['label']

# Split into Training and Testing sets (80% train, 20% test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# ==========================================
# 2. FEATURE EXTRACTION (NLP)
# ==========================================
# TF-IDF converts text data into numbers. 
# It inherently captures key words ("urgent", "verify") and URL structures (like "http")
vectorizer = TfidfVectorizer(stop_words='english', lowercase=True, max_features=5000)

X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# ==========================================
# 3. TRAIN THE MODEL
# ==========================================
# Logistic Regression is highly efficient and performant for text classification
model = LogisticRegression(max_iter=1000)
model.fit(X_train_tfidf, y_train)

# ==========================================
# 4. EVALUATION
# ==========================================
y_pred = model.predict(X_test_tfidf)

# Calculate Accuracy
accuracy = accuracy_score(y_test, y_pred)
print("\n" + "="*40)
print(f"Model Accuracy: {accuracy * 100:.2f}%")
print("="*40)

# Display Detailed Classification Report
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Safe', 'Phishing']))

# Generate Confusion Matrix
cm = confusion_matrix(y_test, y_pred)

# Plot Confusion Matrix using Seaborn
plt.figure(figsize=(6, 4))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=['Safe', 'Phishing'], 
            yticklabels=['Safe', 'Phishing'])
plt.ylabel('Actual Label')
plt.xlabel('Predicted Label')
plt.title('Phishing Detection Confusion Matrix')
plt.show()

# ==========================================
# 5. TEST WITH CUSTOM EMAILS
# ==========================================
def predict_email(new_email):
    # Transform the new text using the fitted vectorizer
    email_tfidf = vectorizer.transform([new_email])
    prediction = model.predict(email_tfidf)[0]
    probability = model.predict_proba(email_tfidf)[0]
    
    result = "🚨 PHISHING" if prediction == 1 else "✅ SAFE"
    confidence = probability[prediction] * 100
    
    print(f"\nEmail: '{new_email[:60]}...' \nResult: {result} ({confidence:.2f}% confidence)")

# Sample test cases
predict_email("Hey team, just reminding you that the submission deadline is tomorrow afternoon.")
predict_email("SECURITY ALERT: Update your PayPal security questions immediately by clicking on this link.")