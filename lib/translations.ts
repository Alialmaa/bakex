export type Lang = 'ar' | 'en'

export const T = {
  ar: {
    appName: 'Bakex', appSub: 'نظام إدارة البيكري',
    login: 'تسجيل الدخول', logout: 'خروج', register: 'إنشاء حساب',
    username: 'اسم المستخدم', password: 'كلمة المرور', confirmPassword: 'تأكيد كلمة المرور',
    fullName: 'الاسم الكامل', adminPassword: 'باسورد المدير للتأكيد',
    nav: { dashboard: 'لوحة التحكم', stock: 'المخزون', produce: 'الإنتاج', sales: 'المبيعات', cost: 'حاسبة الكوست', reports: 'التقارير', users: 'إدارة الحسابات' },
    roles: { admin: 'مدير عام', manager: 'مدير', staff: 'موظف', readonly: 'قراءة فقط' },
    stock: { title: 'المخزون', material: 'المادة', qty: 'الكمية', unit: 'الوحدة', min: 'الحد الأدنى', price: 'سعر الوحدة', status: 'الحالة', ok: 'كافٍ', low: 'ناقص', empty: 'نفذ', add: 'إضافة مادة', packType: 'نوع العبوة', packQty: 'عدد العبوات', packContent: 'محتوى العبوة', packPrice: 'سعر العبوة' },
    produce: { title: 'الإنتاج', produces: 'ينتج', produceNow: 'أنتج الآن', insufficient: 'مواد غير كافية', todayLog: 'سجل الإنتاج اليوم', noProduction: 'لا يوجد إنتاج بعد', unitCost: 'كوست الحبة' },
    sales: { title: 'المبيعات', recordToday: 'سجّل مبيعات اليوم', confirm: 'تأكيد المبيعات', log: 'سجل المبيعات', noSales: 'لا توجد مبيعات' },
    cost: { title: 'حاسبة الكوست', ingredients: 'المكونات', unitCost: 'تكلفة الحبة', sellPrice: 'سعر البيع', profit: 'ربح الحبة', margin: 'هامش الربح', breakeven: 'نقطة التعادل', suggested: 'سعر مقترح (30%)' },
    reports: { title: 'التقارير', totalRev: 'إجمالي الإيراد', totalCost: 'إجمالي التكلفة', netProfit: 'صافي الربح', netLoss: 'صافي الخسارة', avgMargin: 'متوسط الهامش', topProducts: 'أعلى ربحاً', botProducts: 'أدنى ربحاً' },
    dashboard: { title: 'لوحة التحكم', todaySales: 'مبيعات اليوم', monthRev: 'إيراد الشهر', monthProfit: 'ربح الشهر', lowStock: 'مواد ناقصة', alerts: 'التنبيهات', recentOps: 'آخر العمليات', perf: 'أداء المنتجات' },
    users: { title: 'إدارة الحسابات', permissions: 'الصلاحيات', role: 'الدور الوظيفي', noAccess: 'غير متاح', myPerms: 'صلاحياتك' },
    btn: { save: 'حفظ', cancel: 'إلغاء', add: '+ إضافة', delete: 'حذف', edit: 'تعديل', confirm: 'تأكيد', back: 'رجوع', enter: 'دخول' },
    err: { required: 'أكمل جميع الحقول', passMismatch: 'كلمة المرور وتأكيدها غير متطابقتين', passShort: 'كلمة المرور قصيرة جداً', userExists: 'اسم المستخدم موجود مسبقاً', wrongAdmin: 'باسورد المدير غير صحيح', wrongCreds: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
    currency: 'ر.س', dir: 'rtl', systemLive: 'النظام يعمل',
  },
  en: {
    appName: 'Bakex', appSub: 'Bakery Management System',
    login: 'Login', logout: 'Logout', register: 'Create Account',
    username: 'Username', password: 'Password', confirmPassword: 'Confirm Password',
    fullName: 'Full Name', adminPassword: 'Admin Password to Confirm',
    nav: { dashboard: 'Dashboard', stock: 'Inventory', produce: 'Production', sales: 'Sales', cost: 'Cost Calc', reports: 'Reports', users: 'User Management' },
    roles: { admin: 'Admin', manager: 'Manager', staff: 'Staff', readonly: 'Read Only' },
    stock: { title: 'Inventory', material: 'Material', qty: 'Quantity', unit: 'Unit', min: 'Min Level', price: 'Unit Price', status: 'Status', ok: 'OK', low: 'Low', empty: 'Empty', add: 'Add Material', packType: 'Package Type', packQty: 'Packages Count', packContent: 'Package Content', packPrice: 'Package Price' },
    produce: { title: 'Production', produces: 'Produces', produceNow: 'Produce Now', insufficient: 'Insufficient stock', todayLog: "Today's Log", noProduction: 'No production yet', unitCost: 'Unit cost' },
    sales: { title: 'Sales', recordToday: "Record Today's Sales", confirm: 'Confirm Sales', log: 'Sales Log', noSales: 'No sales recorded' },
    cost: { title: 'Cost Calculator', ingredients: 'Ingredients', unitCost: 'Unit Cost', sellPrice: 'Sell Price', profit: 'Unit Profit', margin: 'Profit Margin', breakeven: 'Break Even', suggested: 'Suggested (30%)' },
    reports: { title: 'Reports', totalRev: 'Total Revenue', totalCost: 'Total Cost', netProfit: 'Net Profit', netLoss: 'Net Loss', avgMargin: 'Avg Margin', topProducts: 'Top Performers', botProducts: 'Lowest Performers' },
    dashboard: { title: 'Dashboard', todaySales: "Today's Sales", monthRev: 'Monthly Revenue', monthProfit: 'Monthly Profit', lowStock: 'Low Stock', alerts: 'Alerts', recentOps: 'Recent Activity', perf: 'Product Performance' },
    users: { title: 'User Management', permissions: 'Permissions', role: 'Role', noAccess: 'No Access', myPerms: 'Your Permissions' },
    btn: { save: 'Save', cancel: 'Cancel', add: '+ Add', delete: 'Delete', edit: 'Edit', confirm: 'Confirm', back: 'Back', enter: 'Login' },
    err: { required: 'Please fill all required fields', passMismatch: 'Passwords do not match', passShort: 'Password too short', userExists: 'Username already exists', wrongAdmin: 'Wrong admin password', wrongCreds: 'Invalid username or password' },
    currency: 'SAR', dir: 'ltr', systemLive: 'System Live',
  }
}

export const ROLE_CONFIG = {
  admin:    { bg: '#E1F5EE', color: '#085041', defaultPerms: { dashboard:true, stock:true, produce:true, sales:true, cost:true, reports:true, users:true } },
  manager:  { bg: '#E6F1FB', color: '#0C447C', defaultPerms: { dashboard:true, stock:true, produce:true, sales:true, cost:true, reports:true, users:false } },
  staff:    { bg: '#FAEEDA', color: '#854F0B', defaultPerms: { dashboard:true, stock:true, produce:true, sales:true, cost:false, reports:false, users:false } },
  readonly: { bg: '#F1EFE8', color: '#5F5E5A', defaultPerms: { dashboard:true, stock:false, produce:false, sales:false, cost:false, reports:true, users:false } },
}
