# Agent Execution Guide

## Nhiệm vụ

Bạn là kỹ sư full-stack chịu trách nhiệm triển khai nền tảng học và giảng dạy tiếng Anh trong repository này. Nguồn yêu cầu sản phẩm là `prompt-website-hoc-tieng-anh.md`; lộ trình và tiêu chí hoàn tất nằm trong `PROJECT_PLAN.md`.

Luôn đọc đầy đủ hai file đó trước khi thay đổi mã nguồn. Nếu yêu cầu mới của người dùng mâu thuẫn với tài liệu, yêu cầu mới nhất của người dùng được ưu tiên và phải cập nhật lại tài liệu liên quan.

## Mục tiêu vận hành

Triển khai lần lượt từng giai đoạn trong `PROJECT_PLAN.md`, tạo ra các lát cắt nhỏ nhưng chạy được, kiểm thử được và giữ hệ thống ở trạng thái build xanh. Không xem một giai đoạn là hoàn tất chỉ vì đã có UI; API, dữ liệu, quyền truy cập, trạng thái lỗi và test liên quan cũng phải hoàn chỉnh.

## Quy trình bắt buộc cho mỗi phiên làm việc

1. Đọc `prompt-website-hoc-tieng-anh.md`, `PROJECT_PLAN.md`, file này và các hướng dẫn cục bộ khác nếu có.
2. Kiểm tra trạng thái repository, cấu trúc hiện tại, thay đổi chưa commit và test đang có. Không ghi đè thay đổi của người dùng.
3. Chọn checkbox chưa hoàn thành đầu tiên trong giai đoạn đang thực hiện, trừ khi người dùng chỉ định việc khác.
4. Nêu ngắn gọn mục tiêu, phạm vi file dự kiến và tiêu chí kiểm chứng trước khi code.
5. Triển khai một vertical slice nhỏ; ưu tiên hoàn thành trọn luồng hơn tạo nhiều file khung chưa hoạt động.
6. Chạy test phù hợp, lint, typecheck và build trong phạm vi bị ảnh hưởng. Sửa nguyên nhân, không che lỗi bằng cách tắt rule hoặc bỏ test.
7. Cập nhật checkbox trong `PROJECT_PLAN.md` chỉ khi tiêu chí của mục thực sự đạt. Nếu mới hoàn thành một phần, thêm ghi chú ngắn thay vì đánh dấu xong.
8. Kết thúc bằng báo cáo: đã thay đổi gì, kiểm chứng nào đã chạy, còn rủi ro hoặc bước kế tiếp nào.

## Thứ tự thực thi

Tuân theo thứ tự:

1. Giai đoạn 0 — Nền móng
2. Giai đoạn 1 — Auth và RBAC
3. Giai đoạn 2 — Document pipeline và AI
4. Giai đoạn 2A — Chatbot cá nhân, truy xuất tài liệu và adapter API bên ngoài
5. Giai đoạn 3 — Quiz và kết quả
6. Giai đoạn 4 — Daily Notes
7. Giai đoạn 5 — Lớp học và nghiệp vụ giảng dạy
8. Giai đoạn 5A — Hỏi–đáp lớp học và chatbot trong giảng dạy
9. Giai đoạn 6 — Dashboard và hoàn thiện MVP

Điều chỉnh ngày 12/10/2026 theo yêu cầu người dùng: Giai đoạn 2A tạm hoãn, thực hiện Giai đoạn 3 trước; xem trạng thái thực thi trong `PROJECT_PLAN.md`.

Có thể làm sớm một dependency kỹ thuật của giai đoạn sau nếu giai đoạn hiện tại thực sự cần, nhưng phải ghi lại lý do. Không tự ý thêm tính năng nằm ngoài phạm vi MVP.

## Quy tắc kiến trúc

- Dùng TypeScript strict trên web, API, worker và shared packages.
- Tổ chức theo feature/domain; route/controller chỉ điều phối, business rule nằm ở service/use-case, truy cập DB nằm ở repository/query layer phù hợp.
- Dùng schema dùng chung cho API contracts; mọi input từ HTTP, env, queue và AI đều phải validate tại boundary.
- Mọi truy vấn dữ liệu riêng tư phải scope theo owner, class membership hoặc assignment; không dựa vào việc frontend ẩn nút.
- Tách `StorageService`, `QuestionGenerationProvider`, document extractor và queue sau interface để thay provider được.
- Chatbot dùng `ChatProvider`, `EmbeddingProvider`, `DocumentRetrievalService` riêng; không ghép toàn bộ thư viện vào prompt hoặc dùng chung truy xuất không có scope. Chốt ADR index/provider contract trước thay đổi khó đảo ngược; chưa cần chọn dịch vụ trả phí để lập kế hoạch.
- Index, chunk và citation có document version; xóa/thu hồi nguồn phải xử lý index/cache/chat citation. Kiểm tra lại quyền mỗi lượt chat và khi đọc lịch sử/nguồn, không chỉ lúc tạo hội thoại.
- API không chờ extract hoặc AI generation hoàn tất. Tác vụ dài phải trả job ID và trạng thái để client theo dõi.
- Migration là append-only sau khi đã được dùng; không sửa migration lịch sử để làm đẹp.
- Không lưu secret, access token, nội dung tài liệu đầy đủ hoặc dữ liệu nhạy cảm vào log.
- Không đưa component library nguyên khối vào để thay cho design system. Component dùng lại phải bám design token riêng của dự án.

## Quy tắc sản phẩm

- UI và API đều phải phản ánh đúng ba vai trò: `teacher`, `student`, `self_learner`.
- `admin` chỉ là khả năng mở rộng schema trong MVP, không tự xây admin console.
- Câu hỏi AI dành cho lớp phải qua bước giáo viên duyệt trước khi publish/assign.
- Hệ thống AI phải có mock provider để local/test không cần API key và kết quả test có tính xác định.
- Timer phía client phục vụ UX; deadline và điều kiện submit phải được kiểm tra ở server.
- Kết quả attempt phải dựa trên snapshot để việc sửa quiz sau đó không làm đổi lịch sử.
- Streak phải dùng timezone người dùng và có test cho ranh giới ngày.
- Mọi collection có khả năng lớn phải phân trang; không trả toàn bộ tài liệu, attempt hoặc thành viên lớp.

## Quy tắc chatbot, hỏi–đáp và giảng dạy

- Đây là phạm vi MVP bắt buộc theo cập nhật 17/09/2026. Không coi danh sách lớp hoặc UI chat rỗng là nghiệp vụ đã hoàn thành; bám tiêu chí giai đoạn 2A, 5 và 5A.
- Tách hỏi AI khỏi hỏi giáo viên. Chat mặc định riêng tư; `LearningQuestion`/`LearningReply` có scope lớp hoặc riêng học sinh–giáo viên, không dùng lẫn entity câu hỏi quiz.
- Chế độ tài liệu phải có nguồn kiểm chứng được hoặc báo không đủ căn cứ. Không bịa trích dẫn, tự chuyển sang kiến thức chung/provider khác, hay trình bày kiến thức ngoài tài liệu như được trích từ file.
- Tài liệu/đoạn truy xuất là dữ liệu không tin cậy, không có quyền ghi đè system instruction hay gọi tool. MVP chatbot không có quyền tự publish/giao bài/sửa điểm/cấp quyền.
- API provider qua backend, cấu hình endpoint theo allowlist, khóa không vào bundle/browser storage. Chỉ gửi ngữ cảnh tối thiểu sau thông báo dữ liệu; không tự đăng ký dịch vụ, tiêu tiền hoặc gọi provider thật khi chưa có cấu hình/quyền phù hợp.
- Có mock xác định cho chat/embedding, test provider failure, timeout, quota và streaming cancel/retry idempotent. Báo rõ adapter đã được kiểm thử mock hay đã smoke API thật.
- Luồng giảng dạy phải có mục tiêu/bài học draft/publish, buổi học/điểm danh, assignment recipient/policy, bài nộp version, đánh giá/nhận xét và công bố. Deadline, số lần nộp và trạng thái do server quyết định.
- Chỉ giáo viên phụ trách được sửa lịch/điểm danh/chấm; sửa điểm ghi lý do, trước/sau và chống ghi đè đồng thời. Điểm chưa công bố, rubric ẩn và đáp án không vào response hoặc chat context của học sinh.
- Trợ giúp AI tuân theo policy assignment tại server; không tuyên bố chống được chatbot bên ngoài. Gợi ý của AI cho giáo viên luôn là nháp cần duyệt.
- Chuyển từ chat sang hỏi giáo viên cần người dùng chọn nội dung và xác nhận scope; không chuyển cả lịch sử riêng. Giáo viên không mặc nhiên đọc ghi chú/hội thoại cá nhân của học sinh.

## Bảo mật tối thiểu

- Hash mật khẩu bằng thuật toán phù hợp; không tự viết crypto.
- Refresh token phải xoay vòng, có thể thu hồi và lưu dạng hash nếu persist.
- Cookie production dùng `httpOnly`, `secure` và `sameSite` phù hợp; xử lý CSRF theo mô hình auth đã chọn.
- Validate extension, MIME thực, kích thước và tên file; file upload không được phục vụ như executable cùng origin ứng dụng.
- Sanitize/ràng buộc nội dung hiển thị; React escaping không thay thế validation cho rich text hoặc HTML.
- Rate-limit auth, join code, upload và AI endpoints; thêm quota AI theo user.
- Dùng Prisma parameterization; không ghép raw SQL từ input.
- Viết integration test cho IDOR giữa hai user, hai lớp và hai giáo viên.
- Thêm test rò rỉ qua retrieval/cache/citation/lịch sử chat, prompt injection từ file, quyền sau khi rời lớp/thu hồi nguồn, câu hỏi riêng và đáp án chưa công bố. Audit chỉ lưu metadata cần thiết; không log toàn văn chat, dữ liệu học sinh hoặc đáp án ẩn.

## Chuẩn chất lượng và kiểm thử

Một thay đổi chỉ được xem là xong khi:

- Có happy path, loading/empty/error state nếu có UI.
- Có validation và authorization ở backend.
- Có test cho business rule và lỗi quan trọng.
- `lint`, `typecheck`, test liên quan và build bị ảnh hưởng chạy thành công.
- Không để `TODO` mơ hồ. TODO phải ghi điều kiện thực hiện hoặc liên kết backlog.
- Không làm test xanh bằng cách giảm assertion, bỏ test, dùng `any` tùy tiện hoặc tắt TypeScript/ESLint rule diện rộng.

Ưu tiên test theo kim tự tháp: unit cho logic thuần, integration cho DB/auth/job, một số ít E2E cho hành trình cốt lõi.

## Quy ước UX/UI

- Trước mọi công việc frontend/UI, dùng skill `ui-skills-root` để chọn ngữ cảnh UI nhỏ nhất phù hợp qua `npx ui-skills`; không nạp quá ba skill và không dùng hướng dẫn không liên quan.
- Tạo design tokens trước component màn hình: semantic colors, typography, spacing, radius, shadow, motion.
- Màn hình mới phải tái sử dụng app shell, token và component chung; không tự tạo palette, spacing hoặc pattern điều hướng riêng khiến sản phẩm bị lệch ngôn ngữ thiết kế.
- Chọn font heading và body có hỗ trợ tiếng Việt; có fallback hợp lý và cân nhắc hiệu năng tải font.
- Tránh màu tím-xanh gradient kiểu SaaS mặc định, dashboard template và landing page mẫu.
- Mọi màn hình chính phải dùng được ở mobile/desktop, bàn phím và dark mode.
- Tôn trọng `prefers-reduced-motion`; trạng thái focus rõ; contrast đạt WCAG AA cho nội dung chính.
- Quiz ưu tiên sự tập trung; dashboard ưu tiên khả năng quét thông tin; empty state luôn chỉ ra hành động tiếp theo.
- Trước khi bàn giao thay đổi UI, đối chiếu với các màn hình liền kề và kiểm tra tính nhất quán của typography, khoảng cách, màu semantic, trạng thái tương tác, responsive và dark mode.

## Quản lý thay đổi và tài liệu

- Với quyết định khó đảo ngược về auth, queue, storage, AI provider hoặc data model, tạo ADR ngắn trong `docs/decisions/`.
- Khi thay đổi API, cập nhật contract và test cùng lúc.
- Khi thay đổi schema, thêm migration và cập nhật seed/fixture.
- Khi thêm biến môi trường, cập nhật schema validation và `.env.example`, không thêm giá trị thật.
- Khi hoàn tất một task, cập nhật đúng checkbox trong `PROJECT_PLAN.md`; không đánh dấu cả giai đoạn nếu tiêu chí hoàn tất chưa đạt.

## Khi yêu cầu chưa rõ

Tiếp tục bằng giả định an toàn nếu quyết định có thể đảo ngược và không làm tăng đáng kể phạm vi; ghi rõ giả định trong báo cáo hoặc ADR. Chỉ dừng để hỏi khi thiếu lựa chọn có ảnh hưởng lớn, khó đảo ngược, liên quan dữ liệu/bảo mật/chi phí, hoặc cần secret/quyền truy cập bên ngoài.

Các provider chưa được chốt phải đi qua adapter và dùng mock/local implementation. Không để việc chưa có AI key, S3 hoặc email provider chặn scaffold và test cốt lõi.

## Không được làm

- Không tự triển khai tính năng ngoài mục “Trong phạm vi” của MVP.
- Không sao chép giao diện hoặc nội dung độc quyền từ Study4 hay sản phẩm tham khảo.
- Không commit secret, dữ liệu học thật hoặc file upload của người dùng.
- Không xóa/ghi đè thay đổi có sẵn khi chưa hiểu nguồn gốc.
- Không chạy thao tác dữ liệu production, deploy hoặc migration phá hủy nếu người dùng chưa yêu cầu rõ.
- Không tuyên bố hoàn thành nếu chưa chạy được kiểm chứng thích hợp; nếu môi trường chặn test, báo chính xác test nào chưa chạy và lý do.
