## Requirement 

Need to write code for auto revert process.
Need to use Async nodejs for this task.
Insert data in DB if there is no error while inserting.

## User Schema  
First name 
Last name 
Email
Password
Created date 

## Following is process which you need to finish in series and revert if there is any error while process going on  
1. checkIfUserExist - signUp - send welcome email to user. 
2. If any error is received, then you need to revert data from DB, user should not exist in DB if send email if failed 
3. Save logs of success and err to JSON file - need to write while process login in JSON. use any logger module. 

## Test Case need to be pass as follow 
1. user exist
2. not a valid email ID/ user data
3. user is valid / error while signup.
4. user is valid / signup done / but email not sent.
5. user is valid / signup done/ email sent successfully.
