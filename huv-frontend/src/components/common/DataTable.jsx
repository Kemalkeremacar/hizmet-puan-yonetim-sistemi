import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Skeleton, Typography, Box, Pagination, Stack
} from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';

function SkeletonRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <TableRow key={i}>
      {columns.map((col, j) => (
        <TableCell key={j} sx={{ width: col.width }}>
          <Skeleton variant="text" width={col.skeletonWidth || '80%'} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function DataTable({
  columns,
  rows = [],
  loading = false,
  emptyMessage = 'Veri bulunamadı',
  emptyIcon: EmptyIcon = InboxIcon,
  page,
  totalPages,
  onPageChange,
  onRowClick,
  stickyHeader = true,
  maxHeight,
  size = 'small',
  sx,
  rowKeyField = 'id',
  renderRow,
}) {
  const isEmpty = !loading && rows.length === 0;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', ...sx }}>
      <TableContainer sx={{ maxHeight: maxHeight || 'calc(100vh - 320px)' }}>
        <Table stickyHeader={stickyHeader} size={size}>
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell
                  key={i}
                  sx={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    width: col.width,
                    minWidth: col.minWidth,
                    bgcolor: 'background.paper',
                    ...col.headerSx,
                  }}
                  align={col.align || 'left'}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <SkeletonRows columns={columns} />
            ) : isEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={1}>
                    <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : renderRow ? (
              rows.map((row, i) => renderRow(row, i))
            ) : (
              rows.map((row, i) => (
                <TableRow
                  key={row[rowKeyField] ?? i}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col, j) => (
                    <TableCell key={j} align={col.align || 'left'}>
                      {col.render ? col.render(row[col.field], row, i) : (row[col.field] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" py={1.5}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => onPageChange?.(p)}
            color="primary"
            size="small"
          />
        </Stack>
      )}
    </Paper>
  );
}

export default DataTable;
