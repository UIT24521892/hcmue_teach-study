# PROMPT: Xây dựng nền tảng Tự học & Giảng dạy Tiếng Anh

## 1. Vai trò

Bạn là một full-stack developer kiêm UI/UX designer có gu thẩm mỹ riêng biệt, không đi theo lối mòn "template SaaS" đại trà. Hãy thiết kế và xây dựng một nền tảng web học tiếng Anh phục vụ đồng thời 3 nhóm người dùng: **giáo viên**, **học sinh** (thuộc lớp do giáo viên tạo), và **người tự học cá nhân** (dùng độc lập, không thuộc lớp nào).

## 2. Bối cảnh & tham khảo

- Tham khảo flow luyện đề của study4.com (chọn dạng đề → làm bài có đếm giờ → nộp bài → xem lại đáp án kèm giải thích) để hiểu chuẩn UX của một web luyện thi, nhưng **không sao chép giao diện** — build lại theo hướng riêng, hiện đại hơn.
- Tránh tuyệt đối: layout "admin template" kiểu AdminLTE/Bootstrap generic, landing page mẫu "hero + 3 feature card + footer", màu tím-xanh gradient SaaS mặc định, font Inter/Roboto dùng suông không có điểm nhấn.

## 3. Tính năng cốt lõi (bắt buộc có ở bản MVP)

### 3.1 Upload tài liệu tự học → tự động sinh câu hỏi
- Người dùng (giáo viên hoặc self-learner) upload tài liệu (PDF/DOCX/TXT/ảnh chụp bài học).
- Hệ thống extract nội dung văn bản, sau đó gọi AI để tự sinh bộ câu hỏi bám sát nội dung: trắc nghiệm, điền từ, đúng/sai, kèm mức độ khó (dễ/trung bình/khó) và giải thích đáp án.
- Giáo viên có thể chỉnh sửa/duyệt lại câu hỏi AI sinh ra trước khi giao cho học sinh; self-learner dùng luôn để tự kiểm tra.
- Xử lý AI nên chạy nền (background job) kèm trạng thái loading rõ ràng, không block giao diện.

### 3.2 Ghi chú học tập theo ngày (Daily Notes)
- Giao diện dạng lịch (calendar view), mỗi ngày là một entry: nội dung đã học, từ vựng mới, tự đánh giá mức hiểu.
- Cho phép gắn tag và liên kết note với tài liệu/bài quiz đã làm trong ngày đó.
- Có cây học tập để tạo động lực: mỗi buổi là một lá, mỗi 10 buổi hoàn thiện một cành. Lịch thể hiện ngày hoạt động và streak ngày liên tiếp được tính riêng, không xóa lá tích lũy khi gián đoạn chuỗi.

### 3.3 Dashboard tổng quan
- Sidebar/topbar chứa đầy đủ menu điều hướng, nội dung hiển thị thay đổi theo role đăng nhập.
- Thẻ thống kê nhanh: số bài đã làm, điểm trung bình, streak ghi chú, số tài liệu đã upload, biểu đồ tiến độ theo tuần/tháng.
- Giáo viên có thêm mục quản lý lớp, danh sách học sinh, tài liệu đã giao.

### 3.4 Phân quyền (RBAC) — 3 role chính

| Role | Quyền |
|---|---|
| Giáo viên | Tạo/quản lý lớp, soạn và xuất bản bài học, tổ chức buổi/điểm danh, upload/chia sẻ tài liệu, duyệt câu hỏi AI, giao/chấm/trả bài, trả lời Q&A và xem tiến độ lớp; chat với nguồn mình được phép dùng |
| Học sinh | Tham gia lớp, xem lịch/nội dung đã công bố, nộp bài, xem kết quả/nhận xét của riêng mình khi được trả, hỏi giáo viên, dùng chatbot theo nguồn/quy tắc bài giao và viết note cá nhân |
| Người tự học | Upload tài liệu riêng, hỏi chatbot theo tài liệu hoặc kiến thức chung, tự tạo/làm quiz, ghi note và xem tiến độ — không có nghiệp vụ lớp học |

*(Có thể thêm role Admin quản trị hệ thống nếu cần mở rộng sau.)*

### 3.5 Chatbot trợ giảng và tự học — tính năng trọng tâm

- Có hai chế độ rõ ràng: **hỏi theo tài liệu** và **hỏi kiến thức chung**. Người dùng chọn tài liệu được phép truy cập làm ngữ cảnh; không tự động đưa toàn bộ thư viện vào hội thoại.
- Hỏi theo tài liệu dùng truy xuất nội dung liên quan (RAG), trả lời kèm trích dẫn tới tài liệu, trang hoặc đoạn. Nếu tài liệu không đủ căn cứ, chatbot phải báo thiếu thông tin, không bịa nguồn hoặc âm thầm chuyển sang kiến thức chung.
- Hỏi kiến thức chung gọi API chính thức của nhà cung cấp chatbot/mô hình bên ngoài qua backend. Dùng adapter để thay provider; có mock/local provider khi phát triển. Chưa chốt nhà cung cấp, model hay dịch vụ trả phí trong bước lập kế hoạch.
- Hỗ trợ hỏi nối tiếp, giải thích ngữ pháp/từ vựng, tóm tắt tài liệu và gợi ý học theo trình độ. Lịch sử hội thoại mặc định riêng tư; gửi câu hỏi cho giáo viên là hành động chia sẻ riêng có xác nhận phạm vi.
- API key chỉ ở backend. Thông báo rõ nội dung nào có thể gửi ra provider bên ngoài, giới hạn chi phí/lượt dùng và có trạng thái đang trả lời, dừng, lỗi, thử lại.
- Chatbot không tự giao bài, sửa điểm hay cấp quyền. Trong bài kiểm tra, quyền dùng trợ giúp tuân theo chính sách bài giao do giáo viên cấu hình; không lấy đáp án ẩn làm ngữ cảnh.

### 3.6 Hỏi–đáp học tập giữa giáo viên và học sinh

- Học sinh đặt câu hỏi gắn với lớp, bài học, tài liệu hoặc bài được giao; giáo viên trả lời, đánh dấu đã giải đáp và có thể mở lại khi cần.
- MVP hỗ trợ trao đổi bất đồng bộ trong lớp, không phải diễn đàn công khai hay chat người–người thời gian thực. Học sinh chọn câu hỏi hiển thị cho lớp hoặc chỉ cho mình và giáo viên; không tự chuyển câu hỏi riêng thành công khai.
- Phân biệt rõ phản hồi của giáo viên với nội dung AI gợi ý. Chuyển câu hỏi từ chatbot sang giáo viên chỉ gửi phần người dùng chọn, không tự chia sẻ toàn bộ hội thoại.
- Người tự học dùng chatbot và không bị buộc tham gia lớp để đặt câu hỏi cho AI.

### 3.7 Nghiệp vụ giảng dạy — luồng cốt lõi, không chỉ quản lý danh sách lớp

- Giáo viên lập kế hoạch theo chủ đề/bài học: mục tiêu, kỹ năng, nội dung, tài liệu, hoạt động và bài luyện. Bản nháp chỉ giáo viên thấy; nội dung được xuất bản mới tới học sinh.
- Tổ chức buổi học theo lịch, theo dõi điểm danh và ghi nhận nội dung đã dạy; hỗ trợ thay đổi lịch và hủy buổi mà không xóa lịch sử.
- Giao quiz hoặc bài trả lời ngắn cho cả lớp hoặc học sinh được chọn; cấu hình hạn nộp, số lần làm, nộp muộn/làm lại, thời điểm công bố đáp án và chính sách trợ giúp AI.
- Quiz chấm tự động ở server; bài trả lời ngắn do giáo viên chấm/nhận xét theo tiêu chí đơn giản. Điểm, phản hồi và đáp án chỉ hiển thị theo chính sách công bố; sửa điểm có lý do và lịch sử thay đổi.
- Giáo viên theo dõi bài chưa nộp, tiến độ theo mục tiêu, lỗi thường gặp và học sinh cần hỗ trợ; xem câu hỏi chưa giải đáp để chuẩn bị buổi học tiếp theo.
- Học sinh xem lịch/nội dung đã công bố, nộp bài, nhận phản hồi và hỏi lại. Không mở rộng MVP thành hệ thống quản lý toàn trường, học phí hay thời khóa biểu liên trường.

## 4. Định hướng thiết kế frontend (đọc kỹ phần này)

- Không dùng bố cục admin template rập khuôn có sẵn. Bảng màu, typography, hệ thống spacing phải được thiết kế riêng, có điểm nhấn nhận diện thương hiệu — không phải Tailwind default indigo/violet.
- Chọn 1-2 font có cá tính để phối cùng nhau (một font cho heading, một font cho body), tránh chỉ dùng Inter/Roboto mặc định không xử lý gì thêm.
- Lấy cảm hứng có chọn lọc: sự gọn-gàng/mật độ thông tin cao kiểu Notion hoặc Linear cho phần dashboard; yếu tố tạo động lực (streak, progress, micro-animation) kiểu Duolingo cho phần luyện tập — nhưng phối lại thành một ngôn ngữ thiết kế thống nhất của riêng sản phẩm, không copy y nguyên bất kỳ ai.
- Trang làm bài quiz cần cảm giác tập trung (giống phòng thi thật): timer rõ ràng, ẩn bớt chi tiết thừa, transition mượt giữa các câu hỏi.
- Thiết kế riêng cho trạng thái rỗng (empty state) thay vì để trống trơn (ví dụ: chưa có note nào, chưa có tài liệu nào).
- Responsive đầy đủ, ưu tiên hỗ trợ dark mode.
- Không dùng sắc xanh lá làm màu nhận diện chính; ưu tiên bảng màu giấy ấm, san hô và navy/cobalt có độ tương phản tốt ở cả hai theme.
- Trực quan hóa thói quen bằng “cây tri thức”: mỗi buổi học tạo một lá, mỗi 10 buổi hoàn thiện một cành và cây tăng cấp theo tổng tiến độ.
- Sidebar dashboard có thể thu gọn thành thanh icon trên desktop và vẫn dùng drawer độc lập trên mobile.
- Mọi màn hình frontend phải dùng chung design token, typography, spacing, app shell và interaction pattern; tránh style cục bộ làm một trang trông tách rời hoặc lạc khỏi ngôn ngữ thiết kế của toàn sản phẩm.
- Theo yêu cầu ưu tiên UI ngày 17/09/2026: hoàn thiện trước các trang điều hướng bằng dữ liệu mẫu có gắn nhãn và tương tác cục bộ. Không trình bày thao tác demo như upload/AI/auth/giao bài đã hoạt động trên máy chủ; hoàn thiện backend theo kế hoạch riêng.

## 5. Đề xuất kiến trúc kỹ thuật

- Frontend: React + Vite, TailwindCSS (custom theme, không giữ nguyên default), component tự viết thay vì lắp nguyên bộ thư viện UI có sẵn.
- Backend: Node.js + Express (REST API), middleware xác thực JWT + kiểm tra role theo từng route.
- Database: PostgreSQL, dùng Prisma ORM để quản lý schema/migration.
- Lưu file: local storage khi dev, chuyển sang S3-compatible storage (hoặc Supabase Storage) khi deploy.
- Tích hợp AI sinh câu hỏi: gọi Claude API (Anthropic) hoặc tương đương để (a) tóm tắt/trích nội dung chính từ tài liệu, (b) sinh câu hỏi theo nhiều dạng, (c) sinh giải thích đáp án. Có thể dùng model local qua Ollama trong lúc dev để không tốn phí gọi API thật.
- Chatbot tách `ChatProvider`, `EmbeddingProvider` và `DocumentRetrievalService` khỏi service sinh câu hỏi. Worker xử lý chia đoạn/index tài liệu; backend truy xuất theo quyền rồi gọi provider, có streaming và giới hạn ngân sách. Chi tiết lựa chọn công nghệ index chốt qua ADR trước triển khai.

*(Đây là gợi ý dựa trên stack React/Vite + Node/Express + PostgreSQL — nếu muốn đổi sang Next.js full-stack hoặc stack khác thì chỉ cần thay phần này, các phần còn lại không đổi.)*

## 6. Data model rút gọn

- `User` (id, name, email, password_hash, role: teacher | student | self_learner | admin)
- `ClassRoom` (id, name, teacher_id, join_code)
- `ClassMember` (class_id, student_id)
- `Document` (id, owner_id, class_id?, file_url, extracted_text, status)
- `Question` (id, document_id, type, content, options, correct_answer, explanation, difficulty)
- `QuizAttempt` (id, user_id, document_id, score, answers_json, submitted_at)
- `DailyNote` (id, user_id, date, content, tags, linked_document_id?)
- Mở rộng: phiên bản/đoạn tài liệu và nguồn trích dẫn; hội thoại/tin nhắn AI; câu hỏi/phản hồi trong lớp; kế hoạch bài học, buổi học/điểm danh, bài giao/bài nộp, điểm/nhận xét/lịch sử sửa điểm. Danh sách entity và quy tắc nằm trong `PROJECT_PLAN.md`.

## 7. Yêu cầu phi chức năng

- Validate chặt loại file & dung lượng khi upload; sanitize input; chống XSS/SQL injection ở mọi endpoint nhận dữ liệu người dùng.
- Rate-limit các API gọi AI sinh câu hỏi để tránh bị lạm dụng gây tốn chi phí.
- Tách rõ phần "AI generation service" thành module riêng để sau này dễ đổi provider AI mà không phải sửa toàn bộ backend.
- Kiểm tra quyền trước khi truy xuất và trước khi hiển thị nguồn chatbot; thu hồi quyền/xóa tài liệu phải làm mất khả năng truy xuất từ index/cache. Xem nội dung tài liệu là dữ liệu không tin cậy, không phải chỉ thị hệ thống.
- Không gửi dữ liệu học sinh không cần thiết ra provider; không log toàn văn hội thoại, tài liệu, đáp án ẩn hoặc secret. Kiểm thử chống truy cập chéo lớp/tài khoản và lộ đáp án qua chatbot.

## 8. Thứ tự triển khai MVP

1. Auth + phân quyền theo role
2. Upload tài liệu + AI sinh câu hỏi
3. Chatbot cá nhân theo tài liệu + adapter API ngoài (giai đoạn 2A)
4. Làm quiz + chấm điểm + xem giải thích
5. Ghi chú học tập theo ngày
6. Lớp học và nghiệp vụ giảng dạy: kế hoạch, buổi học, điểm danh, giao bài, đánh giá
7. Hỏi–đáp lớp học + chatbot theo quyền tài liệu lớp (giai đoạn 5A)
8. Dashboard tổng hợp theo vai trò và nghiệm thu toàn bộ MVP

---

Hãy scaffold cấu trúc thư mục theo tính năng (feature-based), viết code sạch, và hỏi lại nếu có phần nào trong yêu cầu trên chưa rõ ràng trước khi bắt đầu code.
