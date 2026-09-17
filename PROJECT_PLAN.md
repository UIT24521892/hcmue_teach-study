# Kế hoạch dự án nền tảng học và giảng dạy tiếng Anh

## 1. Mục tiêu sản phẩm

Xây dựng một nền tảng web phục vụ ba nhóm người dùng trong cùng một hệ thống:

- **Giáo viên:** lập kế hoạch giảng dạy, quản lý lớp/buổi học, tải và chia sẻ tài liệu, duyệt nội dung AI, giao/chấm/trả bài, giải đáp câu hỏi và theo dõi tiến độ.
- **Học sinh:** theo lịch/nội dung lớp đã công bố, làm bài, hỏi giáo viên hoặc chatbot theo chính sách, nhận phản hồi và duy trì ghi chú cá nhân.
- **Người tự học:** tải tài liệu riêng, hỏi chatbot có nguồn hoặc kiến thức chung, tạo/làm quiz, ghi chú và theo dõi tiến độ mà không cần tham gia lớp.

MVP phải hoàn thành một vòng lặp học tập trọn vẹn:

`Tạo tài khoản -> tải tài liệu -> trích xuất nội dung -> sinh/duyệt câu hỏi -> làm bài -> xem giải thích -> ghi chú -> xem tiến độ`

**Bổ sung ưu tiên ngày 17/09/2026:** chatbot và nghiệp vụ giảng dạy là các trụ cột bắt buộc của MVP, không phải tiện ích sau cùng. “Hỏi–đáp” được hiểu gồm hỏi AI và hỏi giáo viên trong lớp; phạm vi này có thể điều chỉnh theo xác nhận tiếp theo của người dùng.

Hai hành trình bổ sung phải hoàn chỉnh:

- **Tự học có trợ giảng:** chọn tài liệu -> hỏi chatbot -> đọc câu trả lời/trích dẫn -> hỏi nối tiếp -> luyện tập và ghi chú.
- **Dạy học:** lập mục tiêu/kế hoạch -> xuất bản bài học -> tổ chức buổi học/điểm danh -> giao bài -> học sinh nộp/hỏi -> giáo viên chấm, phản hồi và công bố -> theo dõi, hỗ trợ buổi tiếp theo.

## 2. Phạm vi MVP

### Trong phạm vi

1. Đăng ký, đăng nhập, refresh token, đăng xuất và khôi phục mật khẩu ở mức cơ bản.
2. RBAC cho `teacher`, `student`, `self_learner`; chuẩn bị schema cho `admin` nhưng không xây trang quản trị trong MVP.
3. Upload PDF, DOCX, TXT và ảnh; kiểm tra MIME, phần mở rộng, dung lượng và quyền truy cập.
4. Job nền trích xuất văn bản và sinh câu hỏi; có trạng thái tiến trình, lỗi và khả năng thử lại.
5. Câu hỏi trắc nghiệm, điền từ, đúng/sai; độ khó và giải thích đáp án.
6. Giáo viên xem trước, sửa, duyệt hoặc loại câu hỏi trước khi xuất bản/giao bài.
7. Làm quiz có timer, tự lưu câu trả lời, nộp bài, chấm điểm và xem lại.
8. Daily Notes theo lịch, tag, liên kết tài liệu/quiz và cây học tập kết hợp streak.
9. Dashboard theo vai trò với thống kê và biểu đồ tiến độ.
10. Tạo lớp, tham gia bằng mã, giao quiz và xem tiến độ lớp.
11. Responsive, dark mode, empty/loading/error states và accessibility cơ bản.
12. Chatbot hỏi–đáp theo một/nhiều tài liệu được chọn, trích dẫn nguồn, ngữ cảnh hội thoại và lịch sử riêng tư.
13. Chatbot kiến thức chung qua API provider bên ngoài, adapter thay thế được, mock/local cho dev, quota và kiểm soát dữ liệu gửi đi.
14. Hỏi–đáp bất đồng bộ giáo viên–học sinh trong lớp, liên kết ngữ cảnh học tập, phạm vi lớp/riêng tư và trạng thái giải đáp.
15. Kế hoạch giảng dạy theo chủ đề/bài học, mục tiêu/kỹ năng, draft/publish, lịch buổi học và điểm danh.
16. Giao bài cho lớp hoặc học sinh được chọn, hạn nộp/làm lại/nộp muộn; quiz và bài trả lời ngắn, chấm/nhận xét thủ công, công bố kết quả và lịch sử sửa điểm.

### Ngoài phạm vi MVP

- Thanh toán, gói thuê bao và marketplace nội dung.
- Video call, chat người–người thời gian thực, diễn đàn công khai và chấm bài tự luận bằng AI. Chatbot streaming và hỏi–đáp lớp học bất đồng bộ nằm **trong** MVP.
- Hệ thống quản lý toàn trường, học phí, xếp thời khóa biểu tự động, khoá học marketplace hoặc chatbot tự thao tác thay giáo viên.
- Ứng dụng mobile native, gamification phức tạp, chứng chỉ.
- Trang admin hoàn chỉnh, SSO trường học, đa tổ chức.
- OCR chữ viết tay có độ chính xác cao hoặc biên tập tài liệu cộng tác thời gian thực.

## 3. Nguyên tắc sản phẩm và UX

- Dashboard có mật độ thông tin gọn nhưng không dùng bố cục admin template đại trà.
- Quiz dùng chế độ tập trung: timer rõ, điều hướng câu hỏi nhanh, cảnh báo trước khi nộp và hạn chế chi tiết gây nhiễu.
- Mọi tác vụ dài đều chạy nền; giao diện luôn thể hiện `queued`, `processing`, `ready` hoặc `failed`.
- AI không tự động phát hành nội dung cho lớp. Giáo viên phải duyệt trước khi giao.
- Học sinh chỉ thấy dữ liệu của mình và nội dung được giao; ghi chú luôn là dữ liệu cá nhân.
- Người tự học không nhìn thấy chức năng lớp học không liên quan.
- Chatbot có nhãn chế độ và nguồn; tách kiến thức ngoài tài liệu khỏi câu trả lời có căn cứ. Không có đoạn phù hợp thì báo thiếu nguồn và cho người dùng chủ động chuyển chế độ.
- Hội thoại AI mặc định riêng tư. Giáo viên không mặc nhiên được đọc chat/ghi chú cá nhân của học sinh; câu hỏi được gửi vào lớp có scope riêng, hiển thị rõ trước khi gửi.
- Luồng giảng dạy có trạng thái rõ: bản nháp, đã công bố, đang nhận bài, quá hạn, đã nộp, đã đánh giá, đã trả kết quả. Học sinh không thấy đáp án/nhận xét/điểm chưa công bố.
- Thiết kế nhận diện riêng: tránh gradient tím-xanh mặc định, tránh chỉ dùng Inter/Roboto, hỗ trợ light/dark bằng design token.
- Bảng màu nhận diện không dùng xanh lá làm màu chủ đạo; dashboard dùng giấy ấm, san hô và navy/cobalt.
- Thói quen học tập được trực quan hóa thành cây phát triển theo số buổi (mỗi buổi một lá, mỗi 10 buổi một cành); sidebar desktop có chế độ thu gọn.
- Mọi feature frontend phải tái sử dụng design token, app shell và component chung; mỗi thay đổi UI phải được đối chiếu desktop/mobile, light/dark và các màn hình liền kề để tránh lệch ngôn ngữ thiết kế.

## 4. Kiến trúc được chọn

### Monorepo

```text
frontend/              React + Vite + TypeScript
backend/
  api/                 Node.js + Express + TypeScript
  worker/              tiến trình xử lý tài liệu và AI jobs
  prisma/
    schema.prisma
    migrations/
packages/
  contracts/           schema request/response và kiểu dữ liệu dùng chung
  config/              cấu hình TypeScript/ESLint dùng chung
  ui/                  design tokens và component dùng lại có chọn lọc
docs/
  decisions/           ADR cho quyết định kiến trúc quan trọng
```

### Thành phần kỹ thuật

- **Frontend:** React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod và TailwindCSS với custom theme.
- **Backend:** Express, TypeScript, Prisma, PostgreSQL, REST API dưới `/api/v1`.
- **Job nền:** Redis + BullMQ. API tạo job; worker xử lý extract/OCR/AI và cập nhật trạng thái.
- **File:** adapter `StorageService`; local disk khi dev, S3-compatible khi deploy.
- **AI:** adapter `QuestionGenerationProvider`; provider thật cấu hình qua biến môi trường, provider giả lập dùng cho dev/test.
- **Chatbot:** `ChatProvider` độc lập với sinh câu hỏi; gọi API chính thức qua backend, model/provider do cấu hình quản lý, không cho client gửi endpoint tùy ý. `EmbeddingProvider` và `DocumentRetrievalService` là interface riêng; API key không xuất hiện trong frontend.
- **Truy xuất tài liệu (RAG):** worker tạo phiên bản văn bản, chia đoạn, metadata vị trí và index có phiên bản. Lựa chọn index/vector store xác nhận bằng ADR sau spike; không mặc định thêm hạ tầng trả phí. Truy xuất phải lọc ownership/grant/membership trước khi đưa đoạn cho model, kiểm tra lại quyền khi mở trích dẫn.
- **Vòng đời chat:** request tạo message/run có idempotency key; stream sự kiện có thứ tự và định danh qua SSE hoặc fetch-stream, hỗ trợ dừng/reconnect. Lưu `pending/streaming/completed/failed/cancelled`, đánh dấu câu trả lời dở dang; retry không tạo trùng tin nhắn. Index chạy nền, chat có timeout và giới hạn token/concurrency.
- **Module giảng dạy:** service riêng cho curriculum/lesson, session/attendance, assignment/submission/grading và Q&A; controller không tự quyết định quyền hay lịch công bố. Trạng thái, thời gian và các chuyển đổi do server kiểm tra.
- **Extract:** parser theo loại file; OCR cho ảnh nằm sau interface riêng.
- **Auth:** access token ngắn hạn và refresh token xoay vòng trong cookie `httpOnly`, `secure` khi production.
- **Quan sát:** structured logging, request ID, health/readiness endpoints; không ghi nội dung tài liệu hoặc token vào log.

Nếu môi trường local chưa có Redis hoặc AI key, hệ thống vẫn phải chạy được bằng chế độ job đồng bộ dành cho dev và mock AI provider. Đây chỉ là fallback phát triển, không dùng ở production.

## 5. Mô hình dữ liệu đề xuất

Các entity cốt lõi:

- `User`, `RefreshToken`, `PasswordResetToken`
- `ClassRoom`, `ClassMember`, `ClassInvite`
- `Document`, `DocumentJob`
- `Question`, `QuestionOption`, `QuestionRevision`
- `Quiz`, `QuizQuestion`, `Assignment`
- `QuizAttempt`, `AttemptAnswer`
- `DailyNote`, `Tag`, `DailyNoteTag`, `DailyNoteLink`
- `DocumentVersion`, `DocumentChunk`, `DocumentIndexJob`, `DocumentAccessGrant` (liên kết nội dung được chia sẻ với lớp/bài học)
- `ChatConversation`, `ChatMessage`, `ChatRun`, `ChatCitation`, `AIUsageRecord`
- `TeachingUnit`, `LessonPlan`, `ClassSession`, `AttendanceRecord`
- `AssignmentRecipient`, `AssignmentSubmission`, `AssessmentCriterion`, `GradeRecord`, `GradeRevision`, `TeacherFeedback`
- `LearningQuestion`, `LearningReply` (tách biệt hoàn toàn với `Question` dùng trong quiz)

Quy ước quan trọng:

- Dùng UUID/CUID, `created_at`, `updated_at`; soft delete cho dữ liệu cần khôi phục.
- `Document` thuộc một `owner`; chia sẻ qua grant gắn với lớp/bài học/assignment, không đổi owner. Được giao quiz không mặc nhiên có quyền đọc mọi tài liệu nguồn hoặc đáp án ngân hàng câu hỏi của giáo viên.
- Tách `Quiz` khỏi `Document` để một bộ câu hỏi có thể được biên tập, tái sử dụng và giao nhiều lần.
- `QuizAttempt` lưu snapshot câu hỏi/đáp án cần thiết để lịch sử không thay đổi khi giáo viên sửa quiz.
- Tag dùng quan hệ nhiều-nhiều thay vì chuỗi JSON.
- Mọi truy vấn đều áp dụng ownership hoặc membership scope ở tầng service, không chỉ ẩn trên UI.
- Chunk/index/citation gắn phiên bản tài liệu, trang hoặc đoạn; không bịa số trang cho TXT. Đổi/xóa tài liệu hoặc thu hồi grant phải vô hiệu index/cache liên quan; citation cũ hiển thị đã thay đổi/không còn quyền, không tiết lộ trích đoạn bị thu hồi.
- Hội thoại thuộc một người dùng; context tài liệu của từng lượt được server xác thực lại. Q&A thuộc lớp và có visibility `class` hoặc `teacher_private`; quyền reply/read không suy ra chỉ từ ID URL. Khi rời lớp, người dùng mất quyền tài liệu/Q&A lớp; giữ lịch sử chat không cho phép đọc lại nội dung lớp đã bị thu hồi.
- `LessonPlan` có mục tiêu/kỹ năng, thứ tự trong chủ đề, version và trạng thái xuất bản. Buổi học có giờ bắt đầu/kết thúc/timezone, trạng thái và điểm danh unique theo buổi–học sinh.
- Bài giao lưu chính sách hạn nộp, late/resubmission, công bố kết quả/đáp án và AI; chụp danh sách người nhận khi giao. Học sinh vào lớp sau không tự có bài cũ nếu chưa được giáo viên thêm.
- Bài nộp có version, thời điểm và người nộp; không sửa bài đã chấm bằng cách ghi đè bản cũ. Quiz attempt liên kết assignment khi có; bài trả lời ngắn dùng submission riêng, không lẫn câu hỏi Q&A.
- Điểm/nhận xét tách lưu nháp với công bố. Grade revision ghi người sửa, thời điểm, lý do và giá trị trước/sau; cập nhật điểm đồng thời phải kiểm tra version. Điểm danh và sửa lịch cũng có audit, học sinh không tự sửa.

## 6. API theo module

| Module | Endpoint chính |
|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Documents | `/documents`, `/documents/:id`, `/documents/:id/process`, `/documents/:id/jobs` |
| Questions/Quizzes | `/documents/:id/questions`, `/quizzes`, `/quizzes/:id`, `/quizzes/:id/publish` |
| Attempts | `/quizzes/:id/attempts`, `/attempts/:id/answers`, `/attempts/:id/submit`, `/attempts/:id/review` |
| Notes | `/notes`, `/notes/:id`, `/notes/calendar`, `/notes/heatmap` |
| Classes | `/classes`, `/classes/:id`, `/classes/join`, `/classes/:id/members` |
| Assignments | `/classes/:id/assignments`, `/assignments/:id`, `/assignments/:id/progress` |
| Dashboard | `/dashboard/summary`, `/dashboard/progress` |
| Chatbot | `/chat/conversations`, `/chat/conversations/:id/messages`, `/chat/runs/:id/events`, `/chat/runs/:id/cancel`, `/chat/citations/:id`, `/chat/usage` |
| Index & chia sẻ tài liệu | `/documents/:id/index`, `/documents/:id/index-status`, `/documents/:id/grants` |
| Kế hoạch giảng dạy | `/classes/:id/units`, `/classes/:id/lessons`, `/lessons/:id`, `/lessons/:id/publish` |
| Buổi học & điểm danh | `/classes/:id/sessions`, `/sessions/:id`, `/sessions/:id/attendance` |
| Nộp bài & đánh giá | `/assignments/:id/submissions`, `/submissions/:id`, `/submissions/:id/grade`, `/assignments/:id/release-results`, `/submissions/:id/grade-history` |
| Hỏi–đáp lớp học | `/classes/:id/questions`, `/learning-questions/:id`, `/learning-questions/:id/replies`, `/learning-questions/:id/resolve` |

Request và response phải được validate bằng schema dùng chung. Lỗi trả về một cấu trúc thống nhất gồm `code`, `message`, `details?`, `requestId`.

Các endpoint mới ở trên là thiết kế dự kiến, chưa phải API đã triển khai. Contract sẽ chỉ rõ HTTP method, pagination, scope, idempotency/version và các mã lỗi khi triển khai từng module.

## 7. Các giai đoạn triển khai

### Giai đoạn 0 — Nền móng

- [x] Khởi tạo monorepo, scripts dev/build/test/lint/typecheck.
- [ ] Thiết lập PostgreSQL, Prisma migration và seed dữ liệu ba vai trò. *(Đã tạo Compose, schema, migration và seed; schema validate thành công. Cần bật Docker daemon để chạy migration/seed thực tế.)*
- [x] Thiết lập biến môi trường có schema validation và `.env.example` không chứa secret.
- [x] Xây design tokens, typography, màu sắc, spacing, light/dark theme và app shell responsive.
- [x] Thiết lập CI chạy lint, typecheck, unit test và build.

**Hoàn tất khi:** một lệnh có thể chạy web/API local, health check thành công và CI xanh.

### Giai đoạn 1 — Auth và RBAC

**Lát cắt UI ưu tiên theo yêu cầu ngày 17/09/2026:** xây trước giao diện và điều hướng các trang trong sidebar, không chờ Auth/API. Tất cả dữ liệu demo phải được gắn nhãn; lưu cục bộ không thay thế backend, RBAC hay dữ liệu thật. Chi tiết và cách kiểm thử nằm trong `docs/frontend-ui.md`.

- Dashboard, thư viện tài liệu, danh sách/chi tiết lớp, bài luyện/phòng làm bài/kết quả, ghi chú theo lịch, tiến độ, cài đặt và trang không tìm thấy đã có route riêng.
- Cây SVG phát triển theo buổi học: 1 buổi = 1 lá, 10 buổi = 1 cành. Mỗi cây chứa 100 lá; mốc vượt 100 được biểu diễn bằng cây mới cùng bộ đếm cây đã hoàn thiện. Streak tính theo ngày riêng với tổng số lá.
- Tương tác cục bộ: tìm/lọc tài liệu, kiểm tra file và lưu metadata, duyệt trạng thái tài liệu mẫu, tạo lớp nháp, ghi chú/tag/tự đánh giá, quiz có timer/bản nháp/kết quả, thay đổi hồ sơ/vai trò demo. Không gửi file, không gọi AI, không cấp membership, không chấm điểm thi thật.
- Không đánh dấu hoàn thành các checkbox backend/MVP dưới đây chỉ vì đã có UI. Đăng nhập/đăng ký, question editor, upload/job AI, giao bài và dữ liệu thật vẫn thuộc các giai đoạn tương ứng.
- Kiểm chứng UI cục bộ: 40 frontend tests, 20 E2E trên Chrome (desktop/mobile, light/dark), cùng lint/typecheck/build/format đều qua; tổng unit/integration toàn repo là 47 tests. CI đã thêm bước E2E nhưng chưa có kết quả chạy trên GitHub trong phiên này.

- [ ] Đăng ký theo vai trò hợp lệ, đăng nhập, refresh rotation và đăng xuất.
- [ ] Middleware xác thực, policy ownership/membership và route guard frontend.
- [ ] Profile tối thiểu; sidebar/menu thay đổi theo vai trò.
- [ ] Test matrix quyền của teacher/student/self-learner.

**Hoàn tất khi:** người dùng chỉ truy cập được route và dữ liệu đúng quyền; test chống truy cập chéo tài khoản chạy xanh.

### Giai đoạn 2 — Document pipeline và AI

- [ ] Upload theo multipart với giới hạn loại/kích thước, tên file an toàn và checksum.
- [ ] Storage adapter, parser PDF/DOCX/TXT/image và giới hạn độ dài nội dung.
- [ ] Job queue có retry/backoff/idempotency và hiển thị tiến trình bằng polling.
- [ ] AI provider interface, mock provider, structured output validation và rate limit/quota.
- [ ] Màn hình thư viện tài liệu, trạng thái xử lý, lỗi và retry.
- [ ] Trình duyệt/sửa/duyệt câu hỏi cho teacher; self-learner có thể dùng ngay sau khi xác nhận.

**Hoàn tất khi:** tài liệu mẫu của bốn loại đi hết pipeline và tạo bộ câu hỏi hợp lệ mà không block request.

### Giai đoạn 2A — Chatbot cá nhân và hỏi–đáp theo tài liệu (ưu tiên mới)

**Phụ thuộc:** Auth/RBAC và tài liệu đã extract ở giai đoạn 1–2. Triển khai trước cho teacher/self-learner với tài liệu sở hữu; mở rộng tài liệu lớp ở giai đoạn 5A, không dùng dữ liệu giả để vượt kiểm tra quyền.

- [ ] Spike truy xuất, chốt ADR index/vector store và tiêu chí chất lượng; thêm schema/migration cho version/chunk/index, chat/message/citation và usage.
- [ ] Pipeline chunk/index nền có trạng thái, retry hữu hạn, version/idempotency và re-index khi tài liệu đổi; hỗ trợ loại bỏ dữ liệu khi xóa/thu hồi.
- [ ] `ChatProvider`/`EmbeddingProvider`/retrieval adapter, mock có tính xác định và ít nhất một adapter API ngoài qua cấu hình server; integration test với provider giả, smoke provider thật chỉ khi có key và ngân sách được duyệt.
- [ ] Hai chế độ hỏi theo tài liệu/hỏi chung; chọn nguồn, truy xuất có scope, câu trả lời có trích dẫn kiểm chứng được; thiếu nguồn phải abstain, không tự bật tìm kiếm web hay chuyển provider/chế độ.
- [ ] Hội thoại riêng tư, hỏi nối tiếp, danh sách/phân trang/xóa lịch sử; context window hữu hạn và chính sách lưu/xóa dữ liệu.
- [ ] Streaming, dừng, lỗi, reconnect/retry không trùng lượt; thông báo index chưa sẵn sàng và provider không khả dụng.
- [ ] Rate limit, token/cost quota per-user, concurrency/timeout, usage metadata; khóa request vượt quota và thông báo rõ trước khi gửi dữ liệu ra ngoài.
- [ ] Test grounded answers, thiếu căn cứ, nguồn sai, prompt injection từ file, truy cập chéo owner, thu hồi nguồn giữa hội thoại và lỗi/hết quota provider.

**Hoàn tất khi:** người dùng chọn tài liệu đã xử lý, hỏi và hỏi nối tiếp có nguồn mở được; câu không có căn cứ không bịa đáp án; hỏi chung qua adapter hoạt động; không lộ nội dung ngoài quyền. Không cần key thật để chạy test local/CI; trạng thái xác minh adapter thật phải ghi riêng.

### Giai đoạn 3 — Quiz và kết quả

- [ ] Tạo/publish quiz từ câu hỏi đã duyệt.
- [ ] Màn làm bài tập trung, timer, question navigator và autosave.
- [ ] Submit idempotent, chấm điểm server-side, snapshot attempt.
- [ ] Trang review đáp án/giải thích và lịch sử attempts.
- [ ] Test refresh giữa bài, hết giờ, submit trùng và mất kết nối ngắn.

**Hoàn tất khi:** người dùng hoàn thành flow từ mở quiz đến xem giải thích; điểm không thể sửa từ client.

### Giai đoạn 4 — Daily Notes

- [ ] CRUD note theo ngày, tự đánh giá mức hiểu và tag.
- [ ] Liên kết document/quiz attempt thuộc quyền người dùng.
- [ ] Calendar view, cây học tập và quy tắc streak theo timezone người dùng. *(UI demo có lịch/cây; dùng timezone thiết bị. Timezone tài khoản và dữ liệu backend chưa kết nối.)*
- [ ] Empty states, keyboard navigation và responsive mobile.

**Hoàn tất khi:** note hiển thị đúng ngày/timezone, cây học tập và streak được kiểm thử ở ranh giới ngày.

### Giai đoạn 5 — Lớp học và nghiệp vụ giảng dạy (mở rộng trọng tâm)

- [ ] Giáo viên tạo/sửa/lưu trữ lớp và sinh lại join code.
- [ ] Học sinh tham gia/rời lớp theo policy; chống đoán/brute-force mã.
- [ ] Giáo viên giao quiz với deadline; học sinh thấy danh sách bài được giao.
- [ ] Bảng tiến độ lớp và chi tiết kết quả theo học sinh.
- [ ] Bảo vệ dữ liệu giữa các lớp và giữa các giáo viên.
- [ ] Kế hoạch theo chủ đề/bài học: mục tiêu, kỹ năng, trình tự, tài liệu/hoạt động và version; luồng nháp -> công bố -> lưu trữ, không lộ bản nháp cho học sinh.
- [ ] Lịch buổi học theo timezone, đổi/hủy lịch, nội dung đã dạy; giáo viên ghi điểm danh có mặt/vắng/đi muộn/có phép, học sinh chỉ xem bản thân.
- [ ] Chia sẻ tài liệu theo grant rõ ràng; thu hồi quyền khi rời lớp hoặc gỡ tài liệu, cập nhật index/cache phục vụ chatbot.
- [ ] Bài giao cho cả lớp hoặc học sinh được chọn, loại quiz/bài trả lời ngắn; snapshot người nhận, deadline, số lần làm, late/resubmission và chính sách AI/đáp án.
- [ ] Bài trả lời ngắn nộp theo version; giáo viên chấm theo tiêu chí, lưu nhận xét nháp và trả bài; không có chấm tự luận bằng AI trong MVP.
- [ ] Sổ điểm lớp, trạng thái chưa nộp/đúng hạn/muộn/đã chấm/đã trả; sửa điểm có lý do, audit và bảo vệ cập nhật đồng thời.
- [ ] Dashboard giảng dạy theo lớp/bài học: mức hoàn thành, kỹ năng/mục tiêu, lỗi phổ biến và danh sách cần hỗ trợ; chỉ tổng hợp dữ liệu đã được phép xem.
- [ ] E2E vòng đời giảng dạy, test deadline/timezone, join/leave sau khi giao bài, resubmission, công bố/ẩn kết quả và chống đọc điểm bạn khác.

**Hoàn tất khi:** teacher tạo lớp -> soạn/xuất bản bài học -> mở buổi/điểm danh -> giao quiz và bài ngắn -> student nộp -> teacher chấm/nhận xét/công bố -> student xem phản hồi; thay đổi điểm/lịch có dấu vết, chưa công bố không bị lộ.

### Giai đoạn 5A — Hỏi–đáp lớp học và chatbot trong giảng dạy

**Phụ thuộc:** chatbot cá nhân 2A và membership, lesson/assignment/grant ở giai đoạn 5. Không triển khai như diễn đàn công khai.

- [ ] Schema/API/UI câu hỏi–phản hồi gắn lớp và ngữ cảnh bài học/tài liệu/bài giao; tìm/lọc/phân trang, trạng thái `open/answered/resolved` và mở lại.
- [ ] Học sinh chọn hỏi cả lớp hoặc hỏi riêng giáo viên; giáo viên lớp phản hồi/đánh dấu giải đáp; MVP chưa cho học sinh khác trả lời, chỉ đọc câu hỏi công khai trong lớp.
- [ ] Chuyển câu hỏi AI sang giáo viên: xem trước đoạn được chia sẻ, chọn phạm vi, tạo Q&A riêng; không tự gửi lịch sử chat hoặc tài liệu người nhận không có quyền.
- [ ] Chatbot đọc tài liệu lớp đã được grant, kiểm tra lại membership/publish/assignment mỗi lượt và khi mở nguồn; rời lớp/thu hồi grant phải ngừng cung cấp nội dung liên quan.
- [ ] Chính sách AI theo bài giao: được trợ giúp khi luyện, bị hạn chế/tắt trong kiểm tra; endpoint server không đưa đáp án, rubric ẩn hoặc nội dung chưa công bố vào retrieval/context. Không tuyên bố ngăn được công cụ AI ngoài nền tảng.
- [ ] AI gợi ý trả lời/hoạt động giảng dạy chỉ là bản nháp, ghi nhãn và chờ giáo viên duyệt; không tự đóng câu hỏi, sửa điểm hay xuất bản bài.
- [ ] Danh sách câu hỏi chưa phản hồi và nhãn có phản hồi mới trong lớp; polling trong app, không phụ thuộc email hay WebSocket.
- [ ] Test scope lớp/riêng tư, chuyển chat có consent, người rời lớp, lộ đáp án bài đang làm và phân biệt tác giả AI/giáo viên.

**Hoàn tất khi:** student hỏi trong ngữ cảnh bài học -> teacher nhận/giải đáp -> student đọc và theo dõi trạng thái; chatbot chỉ dùng nguồn đã công bố và đúng quyền; câu hỏi riêng không xuất hiện với học sinh khác.

### Giai đoạn 6 — Dashboard và hoàn thiện MVP

- [ ] Summary cards và biểu đồ tuần/tháng theo từng vai trò.
- [ ] Tối ưu query/index, phân trang và cache dữ liệu tổng hợp phù hợp.
- [ ] Accessibility audit, responsive audit và dark-mode audit.
- [ ] Security checklist, rate limit, upload abuse cases và dependency audit.
- [ ] E2E cho ba user journey; tài liệu setup/deploy/backup.
- [ ] Dashboard teacher có lịch dạy, bài cần chấm, câu hỏi chưa trả lời và học sinh cần hỗ trợ; dashboard learner có lịch học/bài giao, phản hồi mới và lối vào chatbot.
- [ ] Nghiệm thu xuyên suốt chatbot/RAG, hỏi–đáp lớp và vòng đời giảng dạy; audit quyền dữ liệu, nội dung gửi provider, chi phí và xóa/thu hồi dữ liệu.

**Hoàn tất khi:** toàn bộ tiêu chí nghiệm thu ở mục 8 đạt trên môi trường staging.

## 8. Tiêu chí nghiệm thu MVP

- Ba vai trò hoàn thành được user journey của mình và không đọc/sửa dữ liệu ngoài scope.
- Upload sai loại, quá dung lượng hoặc nội dung không đọc được trả lỗi rõ ràng.
- Job AI có trạng thái, retry hữu hạn, không tạo trùng câu hỏi khi chạy lại.
- Giáo viên có bước duyệt trước khi câu hỏi được giao cho lớp.
- Quiz autosave, timer và submit hoạt động ổn định; chấm điểm diễn ra ở backend.
- Daily Notes, cây học tập và streak đúng với timezone đã cấu hình.
- Dashboard chỉ tính dữ liệu mà người dùng có quyền xem.
- Các màn chính dùng tốt ở mobile và desktop, light và dark mode.
- Không có secret trong repository; input validation, rate limiting, security headers và upload validation được bật.
- CI chạy xanh: lint, typecheck, unit/integration tests, build và E2E smoke test.
- Chatbot trả lời câu hỏi theo nguồn có citation đúng phiên bản/vị trí; truy vấn không có căn cứ báo thiếu thông tin, không dựng nguồn. Hai chế độ tài liệu/kiến thức chung được phân biệt rõ.
- Chat history riêng tư, nguồn ngoài scope không vào context/cache; xóa/thu hồi tài liệu hoặc rời lớp khiến nội dung liên quan không còn truy xuất/hiển thị được, kể cả citation/chat đã lưu.
- Provider bên ngoài chỉ được gọi qua backend với key server-side, quota/timeout và thông báo dữ liệu gửi đi. Local/CI chạy bằng mock; kết quả smoke provider thật được báo riêng, không suy từ mock.
- Giáo viên hoàn thành vòng lập kế hoạch -> buổi học/điểm danh -> giao -> nộp -> đánh giá -> công bố; student chỉ xem bài/kết quả được cấp quyền. Sửa điểm có lịch sử và lý do.
- Hỏi–đáp lớp hoạt động với cả scope lớp và riêng tư; phản hồi giáo viên không bị lẫn với AI; không chia sẻ lịch sử chat nếu người dùng chưa chủ động chọn.
- Chính sách trợ giúp AI và phát hành đáp án của assignment được server thực thi, không chỉ ẩn nút frontend.

## 9. Chiến lược kiểm thử

- **Unit:** policy, scoring, streak, schema validation, AI output parser.
- **Integration:** auth rotation, database ownership, upload/job lifecycle, submit idempotency.
- **Contract:** request/response giữa web, API và worker.
- **E2E:** ba hành trình chính của teacher, student và self-learner.
- **Security:** IDOR giữa user/lớp, file giả MIME, XSS trong note/question, brute-force join code, rate limit AI.
- **Chatbot/RAG:** fixture tài liệu có ground truth; citation đúng nguồn/vị trí, trả lời có căn cứ và abstention, tách mode; injection trong file, nguồn đã xóa/thu hồi, cache isolation, provider failure/quota, streaming cancel/retry.
- **Giảng dạy/Q&A:** state transition nháp/công bố/nộp/chấm/trả, deadline/timezone, người nhận bài, quyền điểm danh/điểm số, optimistic concurrency và audit; scope hỏi riêng/lớp, rời lớp, chặn đáp án ẩn trong chat.
- **E2E bổ sung:** self-learner upload -> hỏi có nguồn -> quiz -> note; teacher soạn/dạy/giao/chấm/trả; student nhận bài -> hỏi AI theo policy -> hỏi giáo viên -> nộp -> xem phản hồi.

Mỗi lỗi được sửa phải có regression test ở tầng thấp nhất có thể tái hiện đúng lỗi.

## 10. Rủi ro và cách giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| AI trả JSON sai hoặc câu hỏi kém | Structured schema, retry có giới hạn, quality checks và bước duyệt |
| Chi phí AI tăng | quota theo user, rate limit, giới hạn độ dài, cache theo checksum, mock/local provider |
| OCR/parsing thất bại | parser adapter, báo lỗi theo trang/file, cho xem và sửa extracted text về sau |
| Rò dữ liệu giữa lớp/user | policy tập trung, scoped query và integration test IDOR |
| Job chạy trùng | idempotency key, unique constraint và trạng thái job rõ ràng |
| Scope phình to | giữ ngoài phạm vi ở mục 2; mọi thay đổi phạm vi phải cập nhật plan trước |
| Chatbot bịa nguồn hoặc bị nội dung file điều khiển | citation kiểm chứng, abstention, tách chỉ thị khỏi dữ liệu, eval fixture và không cấp tool hành động |
| Lộ tài liệu/đáp án qua retrieval, cache hay chat cũ | scope trước truy xuất, lọc nội dung chưa công bố, kiểm tra quyền khi đọc, invalidation theo grant/version |
| Dữ liệu lớp bị gửi ra provider ngoài | thông báo/consent phù hợp, data minimization, provider allowlist, retention policy và không log nội dung |
| Nghiệp vụ chấm/trả bài mâu thuẫn hoặc thất lạc lịch sử | state machine server, version bài nộp/điểm, audit và test đồng thời/deadline |

## 11. Quyết định cần chốt trước production

Các mục này không chặn việc scaffold và phát triển bằng adapter/mock:

1. Nhà cung cấp AI và ngân sách/quota theo người dùng.
2. S3-compatible provider, CDN và thời gian lưu file gốc.
3. Dịch vụ gửi email cho reset password/invite.
4. Giới hạn file chính thức và chính sách riêng tư/xóa dữ liệu.
5. Hạ tầng deploy, monitoring và backup PostgreSQL/Redis.
6. Provider/model chat và embedding, chính sách dữ liệu của provider, consent và khả năng chọn local; ngân sách/token quota cho teacher/student/self-learner. Chưa tự đăng ký hoặc mua dịch vụ.
7. Index/vector store sau spike; chuẩn chunk/version/citation và bộ eval được giáo viên duyệt. Trước triển khai 2A phải chốt ngưỡng groundedness, citation correctness và abstention trên fixture, không chỉ test có response.
8. Quy tắc giảng dạy mặc định trước giai đoạn 5: timezone, thang điểm/tiêu chí, nộp muộn/làm lại, thời điểm trả đáp án và chính sách AI khi kiểm tra; lưu thành cấu hình có thể ghi đè theo assignment.
9. Chính sách lưu/xóa hội thoại, điểm/bài nộp và Q&A lớp; bảo vệ dữ liệu học sinh và phạm vi giáo viên được xem. Chốt trước khi dùng dữ liệu thật.

## 12. Thứ tự ưu tiên backlog sau MVP

1. Chất lượng pipeline tài liệu và trải nghiệm quiz.
2. Analytics học tập sâu hơn và gợi ý ôn tập.
3. Ngân hàng câu hỏi dùng lại, import/export.
4. Thông báo deadline và email digest.
5. Admin console, subscription và tổ chức/trường học.
6. Voice chat AI, đồng giảng/cộng tác nhiều giáo viên, chấm viết AI có kiểm duyệt và thảo luận học sinh–học sinh; không đánh đồng với chatbot văn bản và Q&A lớp bắt buộc trong MVP.
