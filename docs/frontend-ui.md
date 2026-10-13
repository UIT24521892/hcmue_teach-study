# Frontend UI

## Chạy giao diện

```bash
npm run dev -w @mach/web
```

Mở `http://localhost:5173`. Từ 12/10/2026 mọi trang trong không gian học tập đều yêu cầu đăng nhập: khách được chuyển tới `/login?next=<trang>` và quay lại đúng trang sau khi đăng nhập, nên cần chạy API + PostgreSQL (`npm run services:up`, `npm run dev`). Không cần API key AI.

## Các trang

| Đường dẫn | Nội dung và thao tác |
|---|---|
| `/login` | Đăng nhập qua API thật; chờ kiểm tra refresh cookie, hỗ trợ retry khi mất kết nối và `next` nội bộ an toàn |
| `/register` | Tạo tài khoản teacher/student/self-learner qua API thật; không cho tự cấp admin |
| `/account` | Route được bảo vệ, hiển thị hồ sơ chỉ đọc từ API và đăng xuất có xác nhận từ máy chủ |
| `/` | Dashboard gọn: một hero minh họa (khẩu hiệu “Giữ nhịp học, gieo tiến bộ.” + khu vườn SVG vẽ cây tri thức thật của người dùng, chuỗi ngày, số lá, số bài đã nộp), bài học hôm nay và nhịp học bảy ngày |
| `/documents` | Student xem dữ liệu mẫu; teacher/self-learner đã đăng nhập dùng thư viện API thật, upload, polling tiến trình/lỗi/retry và sửa/duyệt câu hỏi AI |
| `/classes` | Lớp mẫu, tạo lớp nháp; học sinh có form mã lớp báo chưa kết nối API |
| `/classes/:classId` | Bài minh họa, bảng học sinh mẫu cho giáo viên |
| `/practice` | Teacher/self-learner đã đăng nhập: khu “Quiz của bạn” dùng API thật (soạn nháp từ câu hỏi đã duyệt, công bố, lưu trữ). Bên dưới vẫn là bài luyện mẫu trên thiết bị, lọc Reading/Vocabulary |
| `/practice/:quizId` | Chế độ tập trung, timer, ba dạng câu hỏi, lưu bản nháp và xác nhận nộp |
| `/results/:attemptId` | Điểm demo, đáp án, giải thích, luyện lại hoặc sang ghi chú |
| `/notes` | Lịch theo “hôm nay” của server (phím mũi tên/Home/End/Page Up/Down), ghi chú lưu máy chủ có tag, tự đánh giá, liên kết tài liệu/bài làm, xóa có xác nhận và cây học tập |
| `/progress` | 7/30 ngày hoạt động, lịch sử kết quả, khu vườn và xem trước mốc trưởng thành |
| `/settings` | Tên hiển thị, mục tiêu tuần, chuyển vai trò xem trước |

Sidebar dùng route thật và đánh dấu trang đang mở. Desktop có chế độ thu gọn được lưu; mobile dùng Radix Dialog để quản lý focus, Escape và ngăn tương tác nền. Hộp tìm kiếm trên header là tìm trang, không giả lập tìm toàn bộ dữ liệu.

## Quy tắc cây và streak trong demo

- Một ghi chú đã lưu trong ngày = một buổi. Sửa cùng ngày không cộng lá.
- Một attempt nộp xong = một buổi; nhiều attempt cùng ngày vẫn chỉ tăng streak một ngày.
- 1 buổi = 1 lá, 10 buổi = 1 cành hoàn chỉnh.
- Mốc 1/10/30/50 buổi: nảy mầm, cây non, vươn cành, vững vàng.
- Mỗi cây vẽ tối đa 100 lá. Sau đó mở cây mới và giữ tổng số cây trưởng thành, tổng lá và cành trong vườn; không âm thầm cắt dữ liệu ở 50 buổi.
- Chuỗi ngày liên tiếp tách khỏi số buổi. Khi hôm nay chưa học, chuỗi tính đến hôm qua vẫn còn. Bỏ một ngày không làm mất lá tích lũy.
- Ngày demo theo timezone thiết bị. Timezone tài khoản và tính streak backend thuộc giai đoạn Daily Notes.

## Giới hạn rõ ràng

- Dữ liệu mẫu được lưu dưới `mach-demo-v1`. Quiz draft dùng `mach-quiz-<id>`; theme/sidebar dùng khóa riêng.
- Access token của phiên thật chỉ nằm trong bộ nhớ; refresh token do API giữ trong cookie `httpOnly`. Mất kết nối khi kiểm tra phiên hoặc đăng xuất có trạng thái lỗi và nút thử lại, không giả vờ đã đăng xuất.
- Ghi chú lưu trên máy chủ (`/notes`). Bản nháp chưa lưu giữ trong `sessionStorage` của tab bằng khóa `mach-note-draft-<userId>-<date>`. Cây học tập và streak ở Ghi chú, Tổng quan, Tiến độ lấy từ `GET /notes/progress` theo múi giờ tài khoản; nhịp học bảy ngày trên Tổng quan lấy từ `GET /notes` và các bài đã nộp (`GET /attempts?status=submitted`), quy đổi về ngày theo múi giờ tài khoản. Thẻ điểm và biểu đồ ở Tiến độ vẫn là dữ liệu mẫu tới Giai đoạn 6. Minh họa trên Tổng quan là SVG nội tuyến dùng token màu, tự đổi theo theme, không tải ảnh ngoài. Khu vườn trong hero có tương tác: giữ và kéo bình tưới để tưới (giọt nước chạm lá làm lá rung), kéo mặt trời rồi thả thì nó lò xo về chỗ cũ, chạm mặt trời thì tỏa nắng; cả hai đều là nút có thể dùng bằng Enter/Space, và tôn trọng `prefers-reduced-motion`.
- Lớp và lịch sử bài luyện có phân trang cục bộ 6 mục/trang. Thư viện/câu hỏi tài liệu thật dùng API phân trang; UI hiện lấy tối đa 50 mục rồi chia trang cục bộ trong khi quy mô MVP còn nhỏ.
- Không còn chế độ khách hay xem trước theo vai trò. Vai trò máy chủ được dùng nhất quán và phần cài đặt chỉ hiển thị vai trò đó; UI không phải RBAC và không thay thế policy backend.
- Không lưu mật khẩu hoặc access token vào local/session storage; không dùng dữ liệu học sinh thật hoặc tài liệu nhạy cảm trong các feature demo.
- Teacher/self-learner tải file lên server: file được kiểm tra lại ở server, lưu riêng tư, extract/OCR và sinh câu hỏi nền; frontend validation không thay thế kiểm tra MIME thực phía server.
- Trình sửa/duyệt câu hỏi đã nối API với version chống ghi đè. Quiz được soạn từ câu hỏi đã duyệt và công bố qua API; giao bài vẫn thuộc giai đoạn sau.
- Quiz là bộ câu hỏi biên soạn sẵn, chấm client-side để thử trải nghiệm. Hết giờ khóa đáp án và yêu cầu nộp. Không dùng kết quả này cho thi cử.
- Lớp tạo mới là bản nháp, chưa cấp mã mời. Danh sách học sinh chỉ là dữ liệu minh họa.
- Đăng ký/đăng nhập/refresh/đăng xuất, hồ sơ chỉ đọc và document pipeline đã nối API. Quiz, bài làm và ghi chú cũng đã nối API. Khôi phục mật khẩu, chỉnh hồ sơ, lớp thật và dashboard tổng hợp vẫn nằm trong `PROJECT_PLAN.md`.

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm run test -w @mach/web
npm run build
npm run test:e2e -w @mach/web
```

E2E dùng Google Chrome đã cài trên máy local. Trên CI, cài Chromium bằng `npx playwright install --with-deps chromium`, chạy với `CI=true`. Bộ E2E tự mở Vite ở cổng 5178, cần cổng còn trống và quyền mở browser/server.

E2E kiểm tra desktop 1440px/mobile 390px, các trang ở cả light/dark, không tràn ngang, menu và focus, quiz autosave/submit/hết giờ, file validation, ghi chú, auth/account/logout recovery, chuyển khách về trang đăng nhập và vai trò xác thực. Mỗi test bắt đầu với phiên teacher giả lập và thư viện máy chủ rỗng. Ảnh toàn trang nằm trong `frontend/test-results/`; kết quả chạy được ignore khỏi source control.

Kết quả kiểm chứng Giai đoạn 2 được ghi trong `PROJECT_PLAN.md`; E2E có riêng trạng thái thư viện/job và trình duyệt câu hỏi ở desktop/mobile, light/dark. API suite chỉ cleanup database `mach_test`; smoke BullMQ dùng tài khoản/file giả trên môi trường local.

Thiết kế ban đầu dùng `ui-skills-root` → `ibelick/baseline-ui`; lượt hoàn thiện auth/role dùng `addyosmani/frontend-ui-engineering`; Giai đoạn 2 dùng context hẹp `dammyjay93/interface-design` cho hierarchy trạng thái bất đồng bộ và form duyệt. Tất cả giữ palette giấy ấm/san hô/navy, shared shell, semantic tokens và component chung. Cây là SVG native, không cần ảnh raster hoặc dịch vụ hình ảnh.
